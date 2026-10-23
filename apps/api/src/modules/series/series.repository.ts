import type {
  CreateSeriesBody,
  PublicationStatus,
  SeriesListQuery,
  UpdateSeriesBody,
} from "@webtoon/contracts";

import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

import { SeriesSlugConflictError } from "./series.errors.js";

export interface SeriesRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverAssetId: string | null;
  createdAt: Date;
}

export interface SeriesDetailRow extends SeriesRow {
  updatedAt: Date;
}

export interface AdminSeriesRow extends SeriesDetailRow {
  publicationStatus: PublicationStatus;
}

export interface SeriesRepository {
  listPublished(query: SeriesListQuery): Promise<{
    rows: SeriesRow[];
    total: number;
  }>;

  findPublishedBySlug(slug: string): Promise<SeriesDetailRow | null>;

  findById(id: string): Promise<AdminSeriesRow | null>;

  createDraft(data: CreateSeriesBody): Promise<AdminSeriesRow | null>;

  update(id: string, data: UpdateSeriesBody): Promise<AdminSeriesRow | null>;
}

const summarySelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverAssetId: true,
  createdAt: true,
} satisfies Prisma.SeriesSelect;

const detailSelect = {
  ...summarySelect,
  updatedAt: true,
} satisfies Prisma.SeriesSelect;

const adminSelect = {
  ...detailSelect,
  publicationStatus: true,
} satisfies Prisma.SeriesSelect;

function rethrowWriteError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new SeriesSlugConflictError();
  }

  throw error;
}

export function createSeriesRepository(prisma: PrismaClient): SeriesRepository {
  return {
    async listPublished({ page, pageSize }) {
      const where = {
        publicationStatus: "PUBLISHED" as const,
      };

      const [rows, total] = await prisma.$transaction(
        [
          prisma.series.findMany({
            where,
            select: summarySelect,

            orderBy: [{ createdAt: "desc" }, { id: "desc" }],

            skip: (page - 1) * pageSize,
            take: pageSize,
          }),

          prisma.series.count({ where }),
        ],
        {
          isolationLevel: "RepeatableRead",
        },
      );

      return { rows, total };
    },

    findPublishedBySlug(slug) {
      return prisma.series.findFirst({
        where: {
          slug,
          publicationStatus: "PUBLISHED",
        },

        select: detailSelect,
      });
    },

    findById(id) {
      return prisma.series.findUnique({
        where: { id },
        select: adminSelect,
      });
    },

    async createDraft(data) {
      try {
        return await prisma.series.create({
          data: {
            title: data.title,
            slug: data.slug,
            description: data.description ?? null,
            coverAssetId: data.coverAssetId ?? null,
            publicationStatus: "DRAFT",
          },

          select: adminSelect,
        });
      } catch (error) {
        rethrowWriteError(error);
      }
    },

    async update(id, data) {
      const changes: Prisma.SeriesUpdateInput = {};

      if (data.title !== undefined) {
        changes.title = data.title;
      }

      if (data.slug !== undefined) {
        changes.slug = data.slug;
      }

      if (data.description !== undefined) {
        changes.description = data.description;
      }

      if (data.coverAssetId !== undefined) {
        changes.coverAssetId = data.coverAssetId;
      }

      if (data.publicationStatus !== undefined) {
        changes.publicationStatus = data.publicationStatus;
      }

      try {
        return await prisma.series.update({
          where: { id },
          data: changes,
          select: adminSelect,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          return null;
        }

        rethrowWriteError(error);
      }
    },
  };
}
