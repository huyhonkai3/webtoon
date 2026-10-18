import { randomUUID } from "node:crypto";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import { pinoHttp } from "pino-http";
import type { Logger } from "pino";

import { createAdminSeriesRouter, createSeriesRouter } from "./modules/series/series.routes.js";
import { localAdminOnly } from "./middleware/local-admin-only.js";
import type { SeriesRepository } from "./modules/series/series.repository.js";
import { createHealthRouter } from "./modules/health/health.routes.js";

import { AppError } from "./shared/errors.js";
import { errorHandler } from "./middleware/error-handler.js";

interface AppDependencies {
  seriesRepository: SeriesRepository;
  checkDatabase: () => Promise<void>;
  logger: Logger;
  webOrigin: string;
  localAdminEnabled?: boolean;
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

  if (deps.localAdminEnabled) {
    app.use(
      "/api/v1/admin/series",
      localAdminOnly(deps.webOrigin),
      createAdminSeriesRouter(deps.seriesRepository),
    );
  }

  app.use((_req, _res, next) => {
    next(new AppError(404, "NOT_FOUND", "Không tìm thấy endpoint."));
  });

  app.use(errorHandler);

  return app;
}
