import 'dotenv/config';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import {
  adminSeriesResponseSchema, seriesDetailResponseSchema, seriesListResponseSchema,
} from '@webtoon/contracts';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { createSeriesRepository } from '../src/modules/series/series.repository.js';
import { createLogger } from '../src/shared/logger.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required; integration tests never use DATABASE_URL');
const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
if (!databaseName.endsWith('_test')) throw new Error('Database kiểm thử phải có tên kết thúc bằng _test');

execFileSync(process.execPath, ['../../node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
  env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'inherit',
});
const prisma = createPrisma(databaseUrl);
const server = createApp({
  seriesRepository: createSeriesRepository(prisma),
  checkDatabase: async () => { await prisma.$queryRaw`SELECT 1`; },
  logger: createLogger('silent'), webOrigin: 'http://localhost:3001',
  localAdminEnabled: true,
});
const adminPath = '/api/v1/admin/series';
const publicPath = '/api/v1/series';

async function create(slug = 'demo') {
  const response = await request(server).post(adminPath)
    .send({ title: 'Demo', slug, description: 'Description' }).expect(201);
  return adminSeriesResponseSchema.parse(response.body).data;
}

test('PostgreSQL → Prisma → HTTP: complete series module', async (t) => {
  try {
    await prisma.series.deleteMany();
    await request(server).get('/health/ready').expect(200);

    await t.test('create draft → publish → edit slug → archive → restore draft', async () => {
      const draft = await create('lifecycle');
      assert.equal(draft.publicationStatus, 'DRAFT');
      assert.equal(draft.coverAssetId, null);
      await request(server).get(publicPath + '/lifecycle').expect(404);
      const initial = await request(server).get(publicPath).expect(200);
      assert.equal(initial.body.pagination.total, 0);
      await request(server).get(adminPath + '/' + draft.id).expect(200);

      await request(server).patch(adminPath + '/' + draft.id)
        .send({ publicationStatus: 'PUBLISHED' }).expect(200);
      const published = await request(server).get(publicPath + '/lifecycle').expect(200);
      assert.equal(seriesDetailResponseSchema.parse(published.body).data.id, draft.id);
      assert.equal(published.body.data.publicationStatus, undefined);

      const edited = await request(server).patch(adminPath + '/' + draft.id)
        .send({ title: 'Updated', slug: 'renamed' }).expect(200);
      const data = adminSeriesResponseSchema.parse(edited.body).data;
      assert.equal(data.description, 'Description');
      assert.equal(data.createdAt, draft.createdAt);
      assert.ok(Date.parse(data.updatedAt) >= Date.parse(draft.updatedAt));
      await request(server).get(publicPath + '/lifecycle').expect(404);
      await request(server).get(publicPath + '/renamed').expect(200);

      await request(server).patch(adminPath + '/' + draft.id)
        .send({ publicationStatus: 'ARCHIVED' }).expect(200);
      await request(server).get(publicPath + '/renamed').expect(404);
      const archived = await request(server).get(adminPath + '/' + draft.id).expect(200);
      assert.equal(archived.body.data.publicationStatus, 'ARCHIVED');
      await request(server).patch(adminPath + '/' + draft.id)
        .send({ publicationStatus: 'DRAFT' }).expect(200);
      await request(server).get(publicPath + '/renamed').expect(404);
    });

    await t.test('nullable fields can be set, retained by partial PATCH and cleared', async () => {
      const draft = await create('nullable');
      const coverAssetId = randomUUID();
      await request(server).patch(adminPath + '/' + draft.id)
        .send({ coverAssetId, description: 'New description' }).expect(200);
      const partial = await request(server).patch(adminPath + '/' + draft.id)
        .send({ title: 'Title only' }).expect(200);
      assert.equal(partial.body.data.coverAssetId, coverAssetId);
      assert.equal(partial.body.data.description, 'New description');
      const cleared = await request(server).patch(adminPath + '/' + draft.id)
        .send({ coverAssetId: null, description: null }).expect(200);
      assert.equal(cleared.body.data.coverAssetId, null);
      assert.equal(cleared.body.data.description, null);
    });

    await t.test('slug uniqueness covers all publication states and failed PATCH is atomic', async () => {
      const first = await create('reserved-slug');
      const second = await create('second-slug');
      const duplicate = await request(server).post(adminPath)
        .send({ title: 'Duplicate', slug: 'reserved-slug' }).expect(409);
      assert.equal(duplicate.body.error.code, 'SERIES_SLUG_CONFLICT');
      const conflict = await request(server).patch(adminPath + '/' + second.id)
        .send({ slug: 'reserved-slug', title: 'Should roll back', publicationStatus: 'PUBLISHED' }).expect(409);
      assert.equal(conflict.body.error.code, 'SERIES_SLUG_CONFLICT');
      const unchanged = await prisma.series.findUniqueOrThrow({ where: { id: second.id } });
      assert.equal(unchanged.title, 'Demo');
      assert.equal(unchanged.slug, 'second-slug');
      assert.equal(unchanged.publicationStatus, 'DRAFT');
      // Giữ nguyên slug của chính truyện không bị xem là trùng.
      await request(server).patch(adminPath + '/' + first.id)
        .send({ slug: 'reserved-slug', publicationStatus: 'ARCHIVED' }).expect(200);
      await request(server).post(adminPath)
        .send({ title: 'Still reserved', slug: 'reserved-slug' }).expect(409);
    });

    await t.test('concurrent creates with one slug produce one 201 and one 409', async () => {
      const responses = await Promise.all([
        request(server).post(adminPath).send({ title: 'A', slug: 'concurrent' }),
        request(server).post(adminPath).send({ title: 'B', slug: 'concurrent' }),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
      assert.equal(await prisma.series.count({ where: { slug: 'concurrent' } }), 1);
    });

    await t.test('public list hides drafts and archived records; tied dates have stable pagination', async () => {
      await prisma.series.deleteMany();
      const ids = [
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ];
      const createdAt = new Date('2026-01-01T00:00:00Z');
      for (const [index, id] of ids.entries()) {
        await prisma.series.create({ data: {
          id, title: 'Published ' + index, slug: 'published-' + index,
          publicationStatus: 'PUBLISHED', createdAt,
        } });
      }
      await prisma.series.create({ data: { title: 'Hidden draft', slug: 'hidden-draft' } });
      await prisma.series.create({ data: {
        title: 'Hidden archive', slug: 'hidden-archive', publicationStatus: 'ARCHIVED',
      } });
      const first = await request(server).get(publicPath + '?pageSize=2').expect(200);
      const firstBody = seriesListResponseSchema.parse(first.body);
      assert.deepEqual(firstBody.pagination, { page: 1, pageSize: 2, total: 3, totalPages: 2 });
      assert.deepEqual(firstBody.data.map((row) => row.id), [ids[2], ids[1]]);
      assert.equal(first.body.data[0].publicationStatus, undefined);
      const second = await request(server).get(publicPath + '?page=2&pageSize=2').expect(200);
      assert.deepEqual(seriesListResponseSchema.parse(second.body).data.map((row) => row.id), [ids[0]]);
      const beyond = await request(server).get(publicPath + '?page=3&pageSize=2').expect(200);
      assert.deepEqual(beyond.body.data, []);
      assert.equal(beyond.body.pagination.total, 3);
      await request(server).get(publicPath + '/hidden-draft').expect(404);
      await request(server).get(publicPath + '/hidden-archive').expect(404);
      const repeated = await request(server).get(publicPath + '?pageSize=2').expect(200);
      assert.deepEqual(repeated.body, first.body);
    });

    await t.test('missing records and invalid writes do not mutate database', async () => {
      const missingId = randomUUID();
      await request(server).get(adminPath + '/' + missingId).expect(404);
      const missing = await request(server).patch(adminPath + '/' + missingId)
        .send({ title: 'Missing' }).expect(404);
      assert.equal(missing.body.error.code, 'SERIES_NOT_FOUND');
      await request(server).get(publicPath + '/missing').expect(404);
      const before = await prisma.series.count();
      await request(server).post(adminPath)
        .send({ title: 'Bad', slug: 'invalid', publicationStatus: 'PUBLISHED' }).expect(400);
      await request(server).post(adminPath)
        .send({ title: ' ', slug: 'invalid' }).expect(400);
      await request(server).patch(adminPath + '/' + missingId).send({}).expect(400);
      assert.equal(await prisma.series.count(), before);
    });

    await t.test('empty public list reports zero pages', async () => {
      await prisma.series.deleteMany();
      const response = await request(server).get(publicPath).expect(200);
      assert.deepEqual(seriesListResponseSchema.parse(response.body), {
        data: [], pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
      });
    });
  } finally {
    try {
      await prisma.series.deleteMany();
    } finally {
      await prisma.$disconnect();
    }
  }
});
