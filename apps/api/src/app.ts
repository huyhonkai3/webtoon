import { randomUUID } from "node:crypto";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import { pinoHttp } from "pino-http";
import type { Logger } from "pino";

import { createHealthRouter } from "./modules/health/health.routes.js";
import {
  createAdminSeriesRouter,
  createSeriesRouter,
} from "./modules/series/series.routes.js";
import {
  createAdminChapterRouter,
  createChapterRouter,
} from "./modules/chapters/chapters.routes.js";

import type { SeriesRepository } from "./modules/series/series.repository.js";
import type { ChapterRepository } from "./modules/chapters/chapters.repository.js";

import { localAdminOnly } from "./middleware/local-admin-only.js";
import { errorHandler } from "./middleware/error-handler.js";
import { AppError } from "./shared/errors.js";
import { Chapter } from "./generated/prisma/client.js";

interface AppDependencies {
  seriesRepository: SeriesRepository;
  chapterRepository: ChapterRepository;
  checkDatabase: () => Promise<void>;
  logger: Logger;
  webOrigin: string;
  localAdminEnabled: boolean;
}

export function createApp(deps: AppDependencies) {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: () => randomUUID(),
    }),
  );

  app.use((req, res, next) => {
    res.setHeader("X-Request-Id", String(req.id));
    next();
  });

  app.use(helmet());

  app.use(
    cors({
      origin: deps.webOrigin,
      exposedHeaders: ["X-Request-Id"],
    }),
  );

  app.use(
    express.json({
      limit: "100kb",
    }),
  );

  app.use("/health", createHealthRouter(deps.checkDatabase));

  app.use("/api/v1/series", createSeriesRouter(deps.seriesRepository));

  app.use(
    "/api/v1/series/:slug/chapters",
    createChapterRouter(deps.chapterRepository),
  );

  if (deps.localAdminEnabled) {
    app.use(
      "/api/v1/admin/series",
      localAdminOnly(deps.webOrigin),
      createAdminSeriesRouter(deps.seriesRepository),
    );
    app.use(
      "/api/v1/admin/series/:seriesId/chapters",
      localAdminOnly(deps.webOrigin),
      createAdminChapterRouter(deps.chapterRepository),
    );
  }

  app.use((_req, _res, next) => {
    next(new AppError(404, "NOT_FOUND", "Không tìm thấy endpoint."));
  });

  app.use(errorHandler);

  return app;
}
