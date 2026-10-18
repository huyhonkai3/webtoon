import { z } from 'zod'

export const seriesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12)
}).strict()

export const seriesSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string().datetime()
})

export const seriesListResponseSchema = z.object({
  data: z.array(seriesSummarySchema),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int()
  })
})

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional()
  })
})

export type SeriesListQuery = z.infer<typeof seriesListQuerySchema>
export type SeriesSummary = z.infer<typeof seriesSummarySchema>
export type SeriesListResponse = z.infer<typeof seriesListResponseSchema>
export type ApiError = z.infer<typeof apiErrorSchema>
