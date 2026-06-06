import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('vendorbridge'),
  APP_PORT: z.coerce.number().int().positive().default(4000),
  APP_GLOBAL_PREFIX: z.string().default('api/v1'),
  APP_CORS_ORIGINS: z.string().default('http://localhost:3000'),
  APP_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('debug'),
  APP_TIMEZONE: z.string().default('UTC'),

  DATABASE_URL: z.string().url(),
  DATABASE_RUNTIME_URL: z.string().url().optional(),

  JWT_PRIVATE_KEY_PATH: z.string().default('./keys/jwt_private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('./keys/jwt_public.pem'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_ISSUER: z.string().default('vendorbridge'),
  JWT_AUDIENCE: z.string().default('vendorbridge-clients'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_FOLDER: z.string().default('vendorbridge'),

  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  UPLOAD_ALLOWED_MIME: z.string().default(
    'application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ),

  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(30),
  AUTH_PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),

  INVOICE_OVERDUE_AFTER_DAYS: z.coerce.number().int().positive().default(30),
  INVOICE_CRON: z.string().default('0 9 * * *'),

  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default('no-reply@vendorbridge.local'),
  SMTP_ENABLED: z.coerce.boolean().default(false),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export interface AppConfig extends EnvConfig {
  jwtPrivateKey: string;
  jwtPublicKey: string;
}

export function loadConfig(): EnvConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
