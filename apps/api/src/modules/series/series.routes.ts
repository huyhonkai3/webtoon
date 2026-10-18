import { Router } from 'express';
import type { SeriesRepository } from './series.repository.js';
import { createSeriesService } from './series.service.js';
import { createSeriesController } from './series.controller.js';

export function createSeriesRouter(repository: SeriesRepository) {
  const router = Router();
  const controller = createSeriesController(createSeriesService(repository));
  router.get('/', controller.list);
  router.get('/:slug', controller.getPublished);
  return router;
}
export function createAdminSeriesRouter(repository: SeriesRepository) {
  const router = Router();
  const controller = createSeriesController(createSeriesService(repository));
  router.post('/', controller.createDraft);
  router.get('/:id', controller.getAdmin);
  router.patch('/:id', controller.update);
  return router;
}
