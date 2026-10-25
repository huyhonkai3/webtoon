import { Router } from "express";

import type { ChapterRepository } from "./chapters.repository.js";
import { createChapterService } from "./chapters.service.js";
import { createChapterController } from "./chapters.controller.js";

export function createChapterRouter(repository: ChapterRepository) {
  const router = Router({ mergeParams: true });
  const controller = createChapterController(createChapterService(repository));

  router.get("/", controller.listPublished);
  router.get("/:number", controller.getPublished);

  return router;
}

export function createAdminChapterRouter(repository: ChapterRepository) {
  const router = Router({ mergeParams: true });
  const controller = createChapterController(createChapterService(repository));

  router.get("/", controller.listAdmin);
  router.post("/", controller.createDraft);
  router.get("/:chapterId", controller.getAdmin);
  router.patch("/:chapterId", controller.update);

  return router;
}
