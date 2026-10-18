import { loadEnv } from "./config/env.js";
import { createLogger } from "./shared/logger.js";
import { createPrisma } from "./database/prisma.js";
import { createApp } from "./app.js";

import { createSeriesRepository } from "./modules/series/series.repository.js";

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const prisma = createPrisma(env.DATABASE_URL);

async function main() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;

  const app = createApp({
    seriesRepository: createSeriesRepository(prisma),

    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },

    logger,
    webOrigin: env.WEB_ORIGIN,
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API listening");
  });

  let stopping = false;

  const shutdown = (signal: string, exitCode = 0) => {
    if (stopping) {
      return;
    }

    stopping = true;

    logger.info({ signal }, "Shutting down");

    const timeout = setTimeout(() => {
      process.exit(1);
    }, 10000).unref();

    server.close(() => {
      void prisma
        .$disconnect()
        .then(() => {
          clearTimeout(timeout);
          process.exit(exitCode);
        })
        .catch((error: unknown) => {
          logger.fatal({ err: error }, "Disconnect failed");
          process.exit(1);
        });
    });
  };

  process.on("SIGNINT", () => {
    shutdown("SIGNINT");
  });

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  server.on("error", (error) => {
    logger.fatal({ err: error }, "HTTP server failed");

    shutdown("server-error", 1);
  });
}

main().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "API startup failed");

  await prisma.$disconnect();

  process.exitCode = 1;
});
