import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import express from 'express';
import {
  adminSeriesResponseSchema, apiErrorSchema, seriesDetailResponseSchema,
  seriesListResponseSchema,
} from '@webtoon/contracts';
import { createApp } from '../src/app.js';
import { envSchema } from '../src/config/env.js';
import { createLogger } from '../src/shared/logger.js';
import { SeriesSlugConflictError } from '../src/modules/series/series.errors.js';
import { localAdminOnly } from '../src/middleware/local-admin-only.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import type { SeriesRepository } from '../src/modules/series/series.repository.js';

const id = '2d5ce438-2bea-45b1-ae4d-e531d31d3dcf';
const row = {
  id, title: 'Demo', slug: 'demo', description: null, coverAssetId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  publicationStatus: 'DRAFT' as const,
};
function app(options: {
  repository?: Partial<SeriesRepository>; databaseDown?: boolean; admin?: boolean;
} = {}) {
  return createApp({
    seriesRepository: {
      listPublished: async () => ({ rows: [row], total: 1 }),
      findPublishedBySlug: async () => row,
      findById: async () => row,
      createDraft: async () => row,
      update: async () => row,
      ...options.repository,
    },
    checkDatabase: async () => {
      if (options.databaseDown) throw new Error('secret connection details');
    },
    logger: createLogger('silent'), webOrigin: 'http://localhost:3001',
    localAdminEnabled: options.admin ?? false,
  });
}
function code(response: request.Response) {
  const { error } = apiErrorSchema.parse(response.body);
  assert.equal(error.requestId, response.headers['x-request-id']);
  return error.code;
}

test('list follows shared contract and exposes only public fields', async () => {
  const response = await request(app()).get('/api/v1/series').expect(200);
  const body = seriesListResponseSchema.parse(response.body);
  assert.equal(body.data[0]?.createdAt, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(body.pagination, { page: 1, pageSize: 12, total: 1, totalPages: 1 });
  assert.equal(response.body.data[0].publicationStatus, undefined);
  assert.equal(response.body.data[0].updatedAt, undefined);
});

test('invalid list query never reaches repository', async () => {
  let calls = 0;
  const server = app({ repository: {
    listPublished: async () => { calls++; return { rows: [], total: 0 }; },
  } });
  for (const query of ['page=0', 'page=1.2', 'pageSize=51', 'page=abc', 'extra=1', 'page=1&page=2']) {
    const response = await request(server).get('/api/v1/series?' + query).expect(400);
    assert.equal(code(response), 'VALIDATION_ERROR');
  }
  assert.equal(calls, 0);
});

test('pagination reaches repository and empty pages are valid', async () => {
  const server = app({ repository: { listPublished: async (query) => {
    assert.deepEqual(query, { page: 2, pageSize: 3 });
    return { rows: [], total: 4 };
  } } });
  const response = await request(server).get('/api/v1/series?page=2&pageSize=3').expect(200);
  assert.equal(response.body.pagination.totalPages, 2);
});

test('public detail follows contract without administration fields', async () => {
  const response = await request(app()).get('/api/v1/series/demo').expect(200);
  const body = seriesDetailResponseSchema.parse(response.body);
  assert.equal(body.data.updatedAt, '2026-01-02T00:00:00.000Z');
  assert.equal(response.body.data.publicationStatus, undefined);
});

test('missing public and admin records return consistent 404', async () => {
  const server = app({ admin: true, repository: {
    findPublishedBySlug: async () => null,
    findById: async () => null,
    update: async () => null,
  } });
  for (const path of ['/api/v1/series/missing', '/api/v1/admin/series/' + id]) {
    assert.equal(code(await request(server).get(path).expect(404)), 'SERIES_NOT_FOUND');
  }
  const response = await request(server).patch('/api/v1/admin/series/' + id)
    .send({ title: 'Changed' }).expect(404);
  assert.equal(code(response), 'SERIES_NOT_FOUND');
});

test('admin creates draft with normalized text and Location header', async () => {
  const server = app({ admin: true, repository: { createDraft: async (data) => {
    assert.deepEqual(data, { title: 'Demo', slug: 'demo', description: 'Description' });
    return { ...row, description: 'Description' };
  } } });
  const response = await request(server).post('/api/v1/admin/series')
    .send({ title: ' Demo ', slug: 'demo', description: ' Description ' }).expect(201);
  assert.equal(adminSeriesResponseSchema.parse(response.body).data.publicationStatus, 'DRAFT');
  assert.equal(response.headers.location, '/api/v1/admin/series/' + id);
});

test('admin reads unpublished records and patches only supplied fields', async () => {
  const server = app({ admin: true, repository: { update: async (receivedId, data) => {
    assert.equal(receivedId, id);
    assert.deepEqual(data, { description: null, publicationStatus: 'PUBLISHED' });
    return { ...row, description: null, publicationStatus: 'PUBLISHED' };
  } } });
  const draft = await request(server).get('/api/v1/admin/series/' + id).expect(200);
  assert.equal(adminSeriesResponseSchema.parse(draft.body).data.publicationStatus, 'DRAFT');
  const response = await request(server).patch('/api/v1/admin/series/' + id)
    .send({ description: null, publicationStatus: 'PUBLISHED' }).expect(200);
  assert.equal(adminSeriesResponseSchema.parse(response.body).data.publicationStatus, 'PUBLISHED');
  assert.equal(response.body.data.title, 'Demo');
});

test('invalid create bodies are rejected before writing', async () => {
  let calls = 0;
  const server = app({ admin: true, repository: { createDraft: async () => { calls++; return row; } } });
  const valid = { title: 'Demo', slug: 'demo' };
  const invalid = [
    {}, null, [], { ...valid, title: ' ' }, { ...valid, title: 'a'.repeat(201) },
    { ...valid, slug: 'a'.repeat(221) }, { ...valid, slug: 'Tiếng Việt' },
    { ...valid, slug: '-demo' }, { ...valid, slug: 'demo--one' },
    { ...valid, description: 'a'.repeat(20_001) }, { ...valid, coverAssetId: 'bad-id' },
    { ...valid, publicationStatus: 'PUBLISHED' }, { ...valid, id },
    { ...valid, status: 'PUBLISHED' },
  ];
  for (const body of invalid) {
    const response = await request(server).post('/api/v1/admin/series')
      .set('Content-Type', 'application/json').send(JSON.stringify(body)).expect(400);
    assert.ok(['VALIDATION_ERROR', 'INVALID_JSON'].includes(code(response)));
  }
  assert.equal(calls, 0);
});

test('invalid patches and route params never reach repository', async () => {
  let calls = 0;
  const server = app({ admin: true, repository: {
    findById: async () => { calls++; return row; },
    findPublishedBySlug: async () => { calls++; return row; },
    update: async () => { calls++; return row; },
  } });
  for (const body of [{}, { title: null }, { slug: '' }, { publicationStatus: 'COMPLETED' },
    { coverAssetId: '' }, { extra: 1 }, { createdAt: '2026-01-01' }]) {
    const response = await request(server).patch('/api/v1/admin/series/' + id).send(body).expect(400);
    assert.equal(code(response), 'VALIDATION_ERROR');
  }
  await request(server).get('/api/v1/admin/series/not-a-uuid').expect(400);
  await request(server).patch('/api/v1/admin/series/not-a-uuid').send({ title: 'OK' }).expect(400);
  await request(server).get('/api/v1/series/INVALID').expect(400);
  assert.equal(calls, 0);
});

test('duplicate slugs return 409 for both create and update', async () => {
  const conflict = async () => { throw new SeriesSlugConflictError(); };
  const server = app({ admin: true, repository: { createDraft: conflict, update: conflict } });
  const created = await request(server).post('/api/v1/admin/series')
    .send({ title: 'Demo', slug: 'demo' }).expect(409);
  const updated = await request(server).patch('/api/v1/admin/series/' + id)
    .send({ slug: 'demo' }).expect(409);
  assert.equal(code(created), 'SERIES_SLUG_CONFLICT');
  assert.equal(code(updated), 'SERIES_SLUG_CONFLICT');
});

test('admin routes are absent by default', async () => {
  const server = app();
  await request(server).post('/api/v1/admin/series').send({ title: 'Demo', slug: 'demo' }).expect(404);
  await request(server).patch('/api/v1/admin/series/' + id).send({ title: 'Demo' }).expect(404);
  await request(server).get('/api/v1/admin/series/' + id).expect(404);
});

test('local admin rejects foreign browser origins', async () => {
  const server = app({ admin: true });
  const response = await request(server).post('/api/v1/admin/series')
    .set('Origin', 'https://foreign.example').send({ title: 'Demo', slug: 'demo' }).expect(403);
  assert.equal(code(response), 'LOCAL_ADMIN_ONLY');
  await request(server).get('/api/v1/admin/series/' + id)
    .set('Origin', 'http://localhost:3001').expect(200);
});

test('local admin ignores spoofed proxy headers from a remote socket', async () => {
  const server = express();
  server.use((req, _res, next) => {
    Object.defineProperty(req.socket, 'remoteAddress', { value: '192.0.2.5', configurable: true });
    next();
  });
  server.use(localAdminOnly('http://localhost:3001'));
  server.get('/', (_req, res) => { res.json({ ok: true }); });
  server.use(errorHandler);
  const response = await request(server).get('/').set('X-Forwarded-For', '127.0.0.1').expect(403);
  assert.equal(response.body.error.code, 'LOCAL_ADMIN_ONLY');
});

test('unexpected database errors do not expose internal details', async () => {
  const fail = async () => { throw new Error('password=secret'); };
  const server = app({ admin: true, repository: {
    listPublished: fail, findPublishedBySlug: fail, findById: fail,
    createDraft: fail, update: fail,
  } });
  const responses = [
    await request(server).get('/api/v1/series').expect(500),
    await request(server).get('/api/v1/series/demo').expect(500),
    await request(server).get('/api/v1/admin/series/' + id).expect(500),
    await request(server).post('/api/v1/admin/series').send({ title: 'Demo', slug: 'demo' }).expect(500),
    await request(server).patch('/api/v1/admin/series/' + id).send({ title: 'Demo' }).expect(500),
  ];
  for (const response of responses) {
    assert.equal(code(response), 'INTERNAL_ERROR');
    assert.ok(!JSON.stringify(response.body).includes('secret'));
  }
});

test('readiness fails while liveness remains available', async () => {
  const server = app({ databaseDown: true });
  await request(server).get('/health/live').expect(200);
  const response = await request(server).get('/health/ready').expect(503);
  assert.equal(code(response), 'DATABASE_UNAVAILABLE');
  assert.ok(!JSON.stringify(response.body).includes('secret'));
});

test('unknown endpoint and malformed JSON use consistent errors', async () => {
  const server = app({ admin: true });
  assert.equal(code(await request(server).get('/missing').expect(404)), 'NOT_FOUND');
  const malformed = await request(server).post('/api/v1/admin/series')
    .set('Content-Type', 'application/json').send('{').expect(400);
  assert.equal(code(malformed), 'INVALID_JSON');
});

test('oversized requests return 413', async () => {
  const response = await request(app({ admin: true })).post('/api/v1/admin/series')
    .send({ title: 'a'.repeat(110_000), slug: 'demo' }).expect(413);
  assert.equal(code(response), 'PAYLOAD_TOO_LARGE');
});

test('CORS and security headers are configured', async () => {
  const response = await request(app()).get('/health/live')
    .set('Origin', 'http://localhost:3001').expect(200);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:3001');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('environment rejects invalid database, port and host', () => {
  assert.equal(envSchema.safeParse({ DATABASE_URL: 'mysql://localhost/db' }).success, false);
  assert.equal(envSchema.safeParse({ DATABASE_URL: 'postgresql://localhost/db', PORT: 0 }).success, false);
  assert.equal(envSchema.safeParse({ DATABASE_URL: 'postgresql://localhost/db', HOST: 'example.com' }).success, false);
  assert.equal(envSchema.parse({ DATABASE_URL: 'postgresql://localhost/db' }).HOST, '127.0.0.1');
});
