import { z } from "zod";
import { publicationStatusSchema } from "./publication-status.js";

const numberSchema = z.number().int().min(1).max(2_147_483_647);
const titleSchema = z.string().trim().min(1).max(200);

const imageUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine(
    (url) => /^https?:\/\//i.test(url),
    "URL ảnh phải dùng HTTP hoặc HTTPS.",
  );

const pageUrlsSchema = z.array(imageUrlSchema).max(200);

export const chapterSeriesSlugParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const chapterSeriesIdParamsSchema = z.object({
  seriesId: z.string().uuid(),
});

export const publicChapterParamsSchema = chapterSeriesSlugParamsSchema.extend({
  number: z.coerce.number().int().min(1).max(2_147_483_647),
});

export const adminChapterParamsSchema = chapterSeriesIdParamsSchema.extend({
  chapterId: z.string().uuid(),
});

export const createChapterBodySchema = z
  .object({
    number: numberSchema,
    title: titleSchema,
    pageUrls: pageUrlsSchema.optional(),
  })
  .strict();

export const updateChapterBodySchema = z
  .object({
    number: numberSchema.optional(),
    title: titleSchema.optional(),
    pageUrls: pageUrlsSchema.optional(),
    publicationStatus: publicationStatusSchema.optional(),
  })
  .strict()
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    "Cần ít nhất một trường để cập nhật.",
  );

export const chapterSummarySchema = z.object({
  id: z.string().uuid(),
  number: numberSchema,
  title: z.string(),
  pageCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export const chapterPageSchema = z.object({
  position: numberSchema,
  imageUrl: imageUrlSchema,
});

export const chapterDetailSchema = chapterSummarySchema.extend({
  updatedAt: z.string().datetime(),
  pages: z.array(chapterPageSchema),
});

export const adminChapterSummarySchema = chapterSummarySchema.extend({
  publicationStatus: publicationStatusSchema,
});

export const adminChapterSchema = chapterDetailSchema.extend({
  publicationStatus: publicationStatusSchema,
});

const paginationSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const chapterListResponseSchema = z.object({
  data: z.array(chapterSummarySchema),
  pagination: paginationSchema,
});

export const adminChapterListResponseSchema = z.object({
  data: z.array(adminChapterSummarySchema),
  pagination: paginationSchema,
});

export const chapterDetailResponseSchema = z.object({
  data: chapterDetailSchema,
});

export const adminChapterResponseSchema = z.object({
  data: adminChapterSchema,
});

export type CreateChapterBody = z.infer<typeof createChapterBodySchema>;
export type UpdateChapterBody = z.infer<typeof updateChapterBodySchema>;
export type ChapterListResponse = z.infer<typeof chapterListResponseSchema>;
export type AdminChapterListResponse = z.infer<
  typeof adminChapterListResponseSchema
>;
export type ChapterDetailResponse = z.infer<typeof chapterDetailResponseSchema>;
export type AdminChapterResponse = z.infer<typeof adminChapterResponseSchema>;
