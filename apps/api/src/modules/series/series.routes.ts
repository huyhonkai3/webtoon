import { Router } from "express";

import type { SeriesRepository } from "./series.repository.js";
import { createSeriesService } from "./series.service.js";
import { createSeriesController } from "./series.controller.js";

export function createSeriesRouter(repository: SeriesRepository) {
  const router = Router();

  const service = createSeriesService(repository);
  const controller = createSeriesController(service);

  router.get("/", controller.list);

  return router;
}
