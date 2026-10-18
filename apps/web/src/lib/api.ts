import "server-only";

import {
  seriesListResponseSchema,
} from "@webtoon/contracts";

export async function getSeries(page: number) {
  const base = process.env.API_BASE_URL;

  if (!base) {
    throw new Error("Thiếu API_BASE_URL trong apps/web/.env.local");
  }

  const url = new URL("/api/v1/series", base);

  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`API trả về HTTP ${response.status}`);
  }
  return seriesListResponseSchema.parse(await response.json());
}
