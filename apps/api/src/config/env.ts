import 'dotenv/config'
import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().url().refine(
    (value) => /^postgres(ql)?:/.test(value),
    'Phải dùng PostgreSQL URL',
  ),

  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  LOG_LEVEL: z.enum([
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent'
  ]).default('info'),
})

export function loadEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;

    throw new Error(
      `Biến môi trường không hợp lệ: ${JSON.stringify(errors)}`
    )
  }

  return result.data
}
