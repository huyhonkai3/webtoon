import type {SeriesListQuery} from '@webtoon/contracts'
import type { PrismaClient } from '../../generated/prisma/client.js'

export interface SeriesRow {
  id: string
  title: string
  slug: string
  description: string | null
  createdAt: Date
}

export interface SeriesRepository {
  listPublished(
    query: SeriesListQuery,
  ): Promise<{
    rows: SeriesRow[];
    total: number;
  }>;
}

export function createSeriesRepository(
  prisma: PrismaClient
): SeriesRepository {
  return {
    async listPublished({ page, pageSize }) {
      const where = {
        status: 'PUBLISHED' as const,
      }

      const [rows, total] = await prisma.$transaction(
        [
          prisma.series.findMany({
            where,

            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              createdAt: true,
            },

            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' }
            ],

            skip: (page - 1) * pageSize,
            take: pageSize,
          }),

          prisma.series.count({where})
        ],
        {
          isolationLevel: 'RepeatableRead'
        }
      )

      return { rows, total }
    }
  }
}
