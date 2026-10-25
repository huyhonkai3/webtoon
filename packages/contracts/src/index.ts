import { z } from "zod";

export const publicationStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

const titleSchema = z.string().trim().min(1).max(200);

const slugSchema = z
  .string()
  .min(1)
  .max(220)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối giữa các từ.",
  );

const descriptionSchema = z.string().trim().max(20_000).nullable();

const coverAssetIdSchema = z.string().uuid().nullable();

export const seriesListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100_000).default(1),

    pageSize: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();

export const seriesSlugParamsSchema = z.object({
  slug: slugSchema,
});

export const seriesIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createSeriesBodySchema = z
  .object({
    title: titleSchema,
    slug: slugSchema,
    description: descriptionSchema.optional(),
    coverAssetId: coverAssetIdSchema.optional(),
  })
  .strict();

export const updateSeriesBodySchema = createSeriesBodySchema
  .partial()
  .extend({
    publicationStatus: publicationStatusSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    "Cần ít nhất một trường để cập nhật.",
  );

export const seriesSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  coverAssetid: coverAssetIdSchema,
  createdAt: z.string().datetime(),
});

export const seriesDetailSchema = seriesSummarySchema.extend({
  updatedAt: z.string().datetime(),
});

export const adminSeriesSchema = seriesDetailSchema.extend({
  publicationStatus: publicationStatusSchema,
});

export const seriesDetailResponseSchema = z.object({
  data: seriesDetailSchema,
});

export const adminSeriesResponseSchema = z.object({
  data: adminSeriesSchema,
});

export const seriesListResponseSchema = z.object({
  data: z.array(seriesSummarySchema),

  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});

export type PublicationStatus = z.infer<typeof publicationStatusSchema>;
export type CreateSeriesBody = z.infer<typeof createSeriesBodySchema>;
export type UpdateSeriesBody = z.infer<typeof updateSeriesBodySchema>;
export type SeriesListQuery = z.infer<typeof seriesListQuerySchema>;
export type SeriesSummary = z.infer<typeof seriesSummarySchema>;
export type SeriesDetail = z.infer<typeof seriesDetailSchema>;
export type AdminSeries = z.infer<typeof adminSeriesSchema>;
export type SeriesDetailResponse = z.infer<typeof seriesDetailResponseSchema>;
export type AdminSeriesResponse = z.infer<typeof adminSeriesResponseSchema>;
export type SeriesListResponse = z.infer<typeof seriesListResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export * from "./chapters.js";
