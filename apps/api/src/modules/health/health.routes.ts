import { Router } from "express";
import { AppError } from "../../shared/errors.js";

export function createHealthRouter(checkDatabase: () => Promise<void>) {
  const router = Router();

  router.get("/live", (_req, res) => {
    res.json({
      status: "ok",
    });
  });

  router.get("/ready", async (req, res) => {
    try {
      await checkDatabase();
    } catch (error) {
      req.log.warn({ err: error }, "Database readiness check failed");

      throw new AppError(
        503,
        "DATABASE_UNAVAILABLE",
        "Cơ sở dữ liệu chưa sẵn sàng.",
      );
    }

    res.json({
      status: "ok",
      database: "up",
    });
  });

  return router;
}
