import type { RequestHandler } from "express";

import {
  createSeriesBodySchema,
  seriesIdParamsSchema,
  seriesListQuerySchema,
  seriesSlugParamsSchema,
  updateSeriesBodySchema,
} from "@webtoon/contracts";

import type { SeriesService } from "./series.service.js";

export function createSeriesController(service: SeriesService) {
  const list: RequestHandler = async (req, res) => {
    const query = seriesListQuerySchema.parse(req.query);
    res.json(await service.list(query));
  };

  const getPublished: RequestHandler = async (req, res) => {
    const { slug } = seriesSlugParamsSchema.parse(req.params);

    res.json(await service.getPublished(slug));
  };

  const getAdmin: RequestHandler = async (req, res) => {
    const { id } = seriesIdParamsSchema.parse(req.params);

    res.json(await service.getAdmin(id));
  };

  const createDraft: RequestHandler = async (req, res) => {
    const body = createSeriesBodySchema.parse(req.body);
    const result = await service.createDraft(body);

    res
      .location(`api/v1/admin/series/${result.data.id}`)
      .status(201)
      .json(result);
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = seriesIdParamsSchema.parse(req.params);
    const body = updateSeriesBodySchema.parse(req.body);

    res.json(await service.update(id, body));
  };

  return {
    list,
    getPublished,
    getAdmin,
    createDraft,
    update,
  };
}
