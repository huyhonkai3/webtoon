import type {
  CreateChapterBody,
  SeriesListQuery,
  UpdateChapterBody,
} from "@webtoon/contracts";

import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  ChapterConcurrentUpdateError,
  ChapterNumberConflictError,
  ChapterPagesRequiredError,
  ChapterSeriesNotFoundError,
} from "./chapters.errors.js";

const summarySelect = {
  id: true,
  number: true,
  title: true,
  createdAt: true,
  _count: { select: { pages: true } },
} satisfies Prisma.ChapterSelect;

const adminSummarySelect = {
  ...summarySelect,
  publicationStatus: true,
} satisfies Prisma.ChapterSelect;

const detailSelect = {
  ...summarySelect,
  updatedAt: true,
  pages: {
    select: { position: true, imageUrl: true },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.ChapterSelect;

const adminSelect = {
  ...detailSelect,
  publicationStatus: true,
} satisfies Prisma.ChapterSelect;

export type ChapterSummaryRow = Prisma.ChapterGetPayload<{
  select: typeof summarySelect;
}>;

export type AdminChapterSummaryRow = Prisma.ChapterGetPayload<{
  select: typeof adminSummarySelect;
}>;

export type ChapterDetailRow = Prisma.ChapterGetPayload<{
  select: typeof detailSelect;
}>;

export type AdminChapterRow = Prisma.ChapterGetPayload<{
  select: typeof adminSelect;
}>;

export interface ChapterRepository {
  findPublicSeries(slug: string): Promise<{ id: string } | null>;
  findSeries(id: string): Promise<{ id: string } | null>;

  listPublished(
    seriesId: string,
    query: SeriesListQuery,
  ): Promise<{ rows: ChapterSummaryRow[]; total: number }>;

  listAdmin(
    seriesId: string,
    query: SeriesListQuery,
  ): Promise<{ rows: AdminChapterSummaryRow[]; total: number }>;

  findPublished(slug: string, number: number): Promise<ChapterDetailRow | null>;

  findById(
    seriesId: string,
    chapterId: string,
  ): Promise<AdminChapterRow | null>;

  createDraft(
    seriesId: string,
    body: CreateChapterBody,
  ): Promise<AdminChapterRow>;

  update(
    seriesId: string,
    chapterId: string,
    body: UpdateChapterBody,
  ): Promise<AdminChapterRow | null>;
}

function rethrowWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ChapterNumberConflictError();
    }
    if (error.code === "P2003" || error.code === "P2025") {
      throw new ChapterSeriesNotFoundError();
    }
    if (error.code === "P2034") {
      throw new ChapterConcurrentUpdateError();
    }
  }

  throw error;
}

export function createChapterRepository(
  prisma: PrismaClient,
): ChapterRepository {
  return {
    findPublicSeries(slug) {
      return prisma.series.findFirst({
        where: { slug, publicationStatus: "PUBLISHED" },
        select: { id: true },
      });
    },

    findSeries(id) {
      return prisma.series.findUnique({
        where: { id },
        select: { id: true },
      });
    },

    async listPublished(seriesId, { page, pageSize }) {
      const where = {
        seriesId,
        publicationStatus: "PUBLISHED" as const,
        series: { publicationStatus: "PUBLISHED" as const },
      };

      const [rows, total] = await prisma.$transaction(
        [
          prisma.chapter.findMany({
            where,
            select: summarySelect,
            orderBy: { number: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.chapter.count({ where }),
        ],
        { isolationLevel: "RepeatableRead" },
      );

      return { rows, total };
    },

    async listAdmin(seriesId, { page, pageSize }) {
      const where = { seriesId };

      const [rows, total] = await prisma.$transaction(
        [
          prisma.chapter.findMany({
            where,
            select: adminSummarySelect,
            orderBy: { number: "asc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.chapter.count({ where }),
        ],
        { isolationLevel: "RepeatableRead" },
      );

      return { rows, total };
    },

    findPublished(slug, number) {
      return prisma.chapter.findFirst({
        where: {
          number,
          publicationStatus: "PUBLISHED",
          series: { slug, publicationStatus: "PUBLISHED" },
        },
        select: detailSelect,
      });
    },

    findById(seriesId, chapterId) {
      return prisma.chapter.findFirst({
        where: { id: chapterId, seriesId },
        select: adminSelect,
      });
    },

    async createDraft(seriesId, body) {
      try {
        return await prisma.chapter.create({
          data: {
            series: { connect: { id: seriesId } },
            number: body.number,
            title: body.title,
            ...(body.pageUrls?.length
              ? {
                  pages: {
                    create: body.pageUrls.map((imageUrl, index) => ({
                      position: index + 1,
                      imageUrl,
                    })),
                  },
                }
              : {}),
          },
          select: adminSelect,
        });
      } catch (error) {
        rethrowWriteError(error);
      }
    },

    async update(seriesId, chapterId, body) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const current = await tx.chapter.findFirst({
              where: { id: chapterId, seriesId },
              select: {
                publicationStatus: true,
                _count: { select: { pages: true } },
              },
            });

            if (!current) return null;

            const nextStatus =
              body.publicationStatus ?? current.publicationStatus;
            const nextPageCount = body.pageUrls?.length ?? current._count.pages;

            if (nextStatus === "PUBLISHED" && nextPageCount === 0) {
              throw new ChapterPagesRequiredError();
            }

            return tx.chapter.update({
              where: { id: chapterId, seriesId },
              data: {
                ...(body.number !== undefined ? { number: body.number } : {}),
                ...(body.title !== undefined ? { title: body.title } : {}),
                ...(body.publicationStatus !== undefined
                  ? { publicationStatus: body.publicationStatus }
                  : {}),
                ...(body.pageUrls !== undefined
                  ? {
                      pages: {
                        deleteMany: {},
                        create: body.pageUrls.map((imageUrl, index) => ({
                          position: index + 1,
                          imageUrl,
                        })),
                      },
                    }
                  : {}),
              },
              select: adminSelect,
            });
          },
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        rethrowWriteError(error);
      }
    },
  };
}
