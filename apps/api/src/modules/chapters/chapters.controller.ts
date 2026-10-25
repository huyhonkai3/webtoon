import type { RequestHandler } from "express";

import {
  adminChapterParamsSchema,
  chapterSeriesIdParamsSchema,
  chapterSeriesSlugParamsSchema,
  createChapterBodySchema,
  publicChapterParamsSchema,
  seriesListQuerySchema,
  updateChapterBodySchema,
} from "@webtoon/contracts";

import type { ChapterService } from "./chapters.service.js";

export function createChapterController(service: ChapterService) {
  const listPublished: RequestHandler = async (req, res) => {
    const { slug } = chapterSeriesSlugParamsSchema.parse(req.params);
    const query = seriesListQuerySchema.parse(req.query);
    res.json(await service.listPublished(slug, query));
  };

  const getPublished: RequestHandler = async (req, res) => {
    const { slug, number } = publicChapterParamsSchema.parse(req.params);
    res.json(await service.getPublished(slug, number));
  };

  const listAdmin: RequestHandler = async (req, res) => {
    const { seriesId } = chapterSeriesIdParamsSchema.parse(req.params);
    const query = seriesListQuerySchema.parse(req.query);
    res.json(await service.listAdmin(seriesId, query));
  };

  const getAdmin: RequestHandler = async (req, res) => {
    const { seriesId, chapterId } = adminChapterParamsSchema.parse(req.params);
    res.json(await service.getAdmin(seriesId, chapterId));
  };

  const createDraft: RequestHandler = async (req, res) => {
    const { seriesId } = chapterSeriesIdParamsSchema.parse(req.params);
    const body = createChapterBodySchema.parse(req.body);
    const result = await service.createDraft(seriesId, body);

    res
      .location(`/api/v1/admin/series/${seriesId}/chapters/${result.data.id}`)
      .status(201)
      .json(result);
  };

  const update: RequestHandler = async (req, res) => {
    const { seriesId, chapterId } = adminChapterParamsSchema.parse(req.params);
    const body = updateChapterBodySchema.parse(req.body);
    res.json(await service.update(seriesId, chapterId, body));
  };

  return {
    listPublished,
    getPublished,
    listAdmin,
    getAdmin,
    createDraft,
    update,
  };
}
