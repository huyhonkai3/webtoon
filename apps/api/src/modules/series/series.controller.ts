import type { RequestHandler } from "express";
import {seriesListQuerySchema} from '@webtoon/contracts'
import type {SeriesService} from './series.service.js'

export function createSeriesController(
  service: SeriesService,
) {
  const list: RequestHandler = async (req, res) => {
    const query = seriesListQuerySchema.parse(
      req.query
    )
    const result = await service.list(query)

    res.json(result)
  }

  return { list }
}
