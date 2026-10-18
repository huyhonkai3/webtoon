import type { ErrorRequestHandler } from "express";
import { ZodError } from 'zod';
import { AppError } from "../shared/errors.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  _next,
) => {
  if (res.headersSent) {
    _next(error)
    return
  }

  const requestId = String(req.id)

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu gửi lên không hợp lệ.',
        requestId,
        details: error.flatten()
      }
    })

    return
  }

  if (
    error instanceof SyntaxError && 'type' in error && error.type === "entity.parse.failed"
  ) {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'JSON không hợp lệ.',
        requestId,
      }
    })
  }

  if (
    error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large'
  ) {
    res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Nội dung vượt quá giới hạn',
        requestId,
      }
    })

    return
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
      }
    })

    return
  }

  req.log.error(
    { err: error },
    'Unhandled request error'
  )

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Đã có lỗi xảy ra ở máy chủ.',
      requestId,
    }
  })
}
