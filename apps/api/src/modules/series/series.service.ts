import type {
  AdminSeriesResponse, CreateSeriesBody, SeriesDetailResponse,
  SeriesListQuery, SeriesListResponse, UpdateSeriesBody,
} from '@webtoon/contracts';
import { AppError } from '../../shared/errors.js';
import { SeriesSlugConflictError } from './series.errors.js';
import type {
  AdminSeriesRow, SeriesDetailRow, SeriesRepository, SeriesRow,
} from './series.repository.js';

function summary(row: SeriesRow) {
  // Chọn trường rõ ràng để response public không lộ trường quản trị.
  return {
    id: row.id, title: row.title, slug: row.slug, description: row.description,
    coverAssetId: row.coverAssetId, createdAt: row.createdAt.toISOString(),
  };
}
function detail(row: SeriesDetailRow) {
  return { ...summary(row), updatedAt: row.updatedAt.toISOString() };
}
function adminResponse(row: AdminSeriesRow): AdminSeriesResponse {
  return { data: { ...detail(row), publicationStatus: row.publicationStatus } };
}
function requireSeries<T>(row: T | null): T {
  if (row === null) throw new AppError(404, 'SERIES_NOT_FOUND', 'Không tìm thấy truyện.');
  return row;
}
async function write(operation: () => Promise<AdminSeriesRow | null>): Promise<AdminSeriesResponse> {
  try {
    return adminResponse(requireSeries(await operation()));
  } catch (error) {
    if (error instanceof SeriesSlugConflictError) {
      throw new AppError(409, 'SERIES_SLUG_CONFLICT', 'Slug truyện đã tồn tại.');
    }
    throw error;
  }
}

export function createSeriesService(repository: SeriesRepository) {
  return {
    async list(query: SeriesListQuery): Promise<SeriesListResponse> {
      const { rows, total } = await repository.listPublished(query);
      return {
        data: rows.map(summary),
        pagination: { ...query, total, totalPages: Math.ceil(total / query.pageSize) },
      };
    },
    async getPublished(slug: string): Promise<SeriesDetailResponse> {
      return { data: detail(requireSeries(await repository.findPublishedBySlug(slug))) };
    },
    async getAdmin(id: string): Promise<AdminSeriesResponse> {
      return adminResponse(requireSeries(await repository.findById(id)));
    },
    createDraft(data: CreateSeriesBody) {
      return write(() => repository.createDraft(data));
    },
    update(id: string, data: UpdateSeriesBody) {
      return write(() => repository.update(id, data));
    },
  };
}
export type SeriesService = ReturnType<typeof createSeriesService>;
