import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors.js';

// Chỉ dùng tạm trong development trước khi có auth. Không tin X-Forwarded-For.
export function localAdminOnly(webOrigin: string): RequestHandler {
  return (req, _res, next) => {
    const address = req.socket.remoteAddress;
    const isLoopback = address === '127.0.0.1' || address === '::1' ||
      address === '::ffff:127.0.0.1';
    const origin = req.get('origin');
    if (!isLoopback || (origin !== undefined && origin !== webOrigin)) {
      next(new AppError(403, 'LOCAL_ADMIN_ONLY', 'API quản trị chỉ dùng từ máy local.'));
      return;
    }
    next();
  };
}
