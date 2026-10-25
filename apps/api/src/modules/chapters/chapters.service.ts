import type {
  AdminChapterListResponse,
  AdminChapterResponse,
  ChapterDetailResponse,
  ChapterListResponse,
  CreateChapterBody,
  SeriesListQuery,
  UpdateChapterBody,
} from "@webtoon/contracts";

import { AppError } from "../../shared/errors.js";
import {
  ChapterConcurrentUpdateError,
  ChapterNumberConflictError,
  ChapterPagesRequiredError,
  ChapterSeriesNotFoundError,
} from "./chapters.errors.js";

import type {
  AdminChapterRow,
  AdminChapterSummaryRow,
  ChapterDetailRow,
  ChapterRepository,
  ChapterSummaryRow,
} from "./chapters.repository.js";

function summary(row: ChapterSummaryRow) {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    pageCount: row._count.pages,
    createdAt: row.createdAt.toISOString(),
  };
}

function adminSummary(row: AdminChapterSummaryRow) {
  return {
    ...summary(row),
    publicationStatus: row.publicationStatus,
  };
}

function detail(row: ChapterDetailRow) {
  return {
    ...summary(row),
    updatedAt: row.updatedAt.toISOString(),
    pages: row.pages.map((page) => ({
      position: page.position,
      imageUrl: page.imageUrl,
    })),
  };
}

function adminResponse(row: AdminChapterRow): AdminChapterResponse {
  return {
    data: {
      ...detail(row),
      publicationStatus: row.publicationStatus,
    },
  };
}

function pagination(query: SeriesListQuery, total: number) {
  return {
    ...query,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

function requireSeries<T>(value: T | null): T {
  if (value === null) {
    throw new AppError(404, "SERIES_NOT_FOUND", "Không tìm thấy truyện.");
  }
  return value;
}

function requireChapter<T>(value: T | null): T {
  if (value === null) {
    throw new AppError(404, "CHAPTER_NOT_FOUND", "Không tìm thấy chương.");
  }
  return value;
}

async function write(
  operation: () => Promise<AdminChapterRow | null>,
): Promise<AdminChapterResponse> {
  try {
    return adminResponse(requireChapter(await operation()));
  } catch (error) {
    if (error instanceof ChapterNumberConflictError) {
      throw new AppError(
        409,
        "CHAPTER_NUMBER_CONFLICT",
        "Số chương đã tồn tại trong truyện.",
      );
    }
    if (error instanceof ChapterSeriesNotFoundError) {
      throw new AppError(404, "SERIES_NOT_FOUND", "Không tìm thấy truyện.");
    }

    if (error instanceof ChapterPagesRequiredError) {
      throw new AppError(
        404,
        "CHAPTER_PAGES_REQUIRED",
        "Chương xuất bản phải có ít nhất một trang ảnh.",
      );
    }

    if (error instanceof ChapterConcurrentUpdateError) {
      throw new AppError(
        409,
        "CHAPTER_CONCURRENT_UPDATE",
        "Chương vừa được cập nhật, hãy tải lại và thử lại.",
      );
    }
    throw error;
  }
}

export function createChapterService(repository: ChapterRepository) {
  return {
    async listPublished(
      slug: string,
      query: SeriesListQuery,
    ): Promise<ChapterListResponse> {
      const series = requireSeries(await repository.findPublicSeries(slug));
      const { rows, total } = await repository.listPublished(series.id, query);

      return {
        data: rows.map(summary),
        pagination: pagination(query, total),
      };
    },

    async getPublished(
      slug: string,
      number: number,
    ): Promise<ChapterDetailResponse> {
      return {
        data: detail(
          requireChapter(await repository.findPublished(slug, number)),
        ),
      };
    },

    async listAdmin(
      seriesId: string,
      query: SeriesListQuery,
    ): Promise<AdminChapterListResponse> {
      requireSeries(await repository.findSeries(seriesId));
      const { rows, total } = await repository.listAdmin(seriesId, query);

      return {
        data: rows.map(adminSummary),
        pagination: pagination(query, total),
      };
    },

    async getAdmin(
      seriesId: string,
      chapterId: string,
    ): Promise<AdminChapterResponse> {
      return adminResponse(
        requireChapter(await repository.findById(seriesId, chapterId)),
      );
    },

    async createDraft(
      seriesId: string,
      body: CreateChapterBody,
    ): Promise<AdminChapterResponse> {
      requireSeries(await repository.findSeries(seriesId));
      return write(() => repository.createDraft(seriesId, body));
    },

    update(
      seriesId: string,
      chapterId: string,
      body: UpdateChapterBody,
    ): Promise<AdminChapterResponse> {
      return write(() => repository.update(seriesId, chapterId, body));
    },
  };
}

export type ChapterService = ReturnType<typeof createChapterService>;
