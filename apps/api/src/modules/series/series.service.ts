import type { SeriesListQuery, SeriesListResponse } from "@webtoon/contracts";
import type { SeriesRepository } from "./series.repository.js";

export function createSeriesService(
  repository: SeriesRepository,
) {
  return {
    async list(
      query: SeriesListQuery,
    ): Promise<SeriesListResponse> {
      const { rows, total } = await repository.listPublished(query)

      return {
        data: rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
        pagination: {
          ...query,
          total,
          totalPages: Math.ceil(
            total / query.pageSize
          )
        }
      }
    }
  }
}

export type SeriesService = ReturnType<typeof createSeriesService>
