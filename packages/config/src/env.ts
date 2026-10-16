import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/pagepulse'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  BETTER_AUTH_SECRET: z.string().min(16).default('0123456789abcdef0123456789abcdef0123456789abcdef'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  ARTIFACT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  ARTIFACT_LOCAL_DIR: z.string().default('./storage/artifacts'),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().default('pagepulse-artifacts'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  ARTIFACT_ENCRYPTION_KEY: z.string().min(32).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('alerts@pagepulse.dev'),
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  CAPTURE_TIMEOUT_MS: z.coerce.number().min(5000).max(120000).default(30000),
  GLOBAL_WORKER_CONCURRENCY: z.coerce.number().min(1).max(32).default(4),
  PER_HOST_CONCURRENCY: z.coerce.number().min(1).max(5).default(1),
  DEFAULT_SNAPSHOT_RETENTION_DAYS: z.coerce.number().min(1).max(365).default(90),
  SENTRY_DSN: z.string().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function parseEnv(rawEnv: Record<string, string | undefined> = process.env): EnvConfig {
  const parsed = EnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${errorMessages}`);
  }
  return parsed.data;
}
