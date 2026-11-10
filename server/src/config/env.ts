import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('*'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Neon connection string)'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  TRAINER_INVITE_CODE: z.string().min(4),
  BREVO_API_KEY: z.string().default(''),
  EMAIL_FROM_ADDRESS: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('Digital Farm Lab'),
  EMAIL_DEV_LOG_ONLY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_FOLDER: z.string().default('digital-farm-lab'),
  /** AgriLearn Passport webhook for microcredential events. Empty = events wait in the outbox. */
  AGRILEARN_WEBHOOK_URL: z.union([z.string().url(), z.literal('')]).default(''),
  /** Shared secret used to sign each event (HMAC-SHA256, X-DFL-Signature header). */
  AGRILEARN_WEBHOOK_SECRET: z.string().default(''),
  /** Minimum score (0–100) for a reflected run to earn the scenario's microcredential. */
  CREDENTIAL_MIN_SCORE: z.coerce.number().min(0).max(100).default(70),
  /** Public base URL of this API, used in share links (defaults to the request host). */
  PUBLIC_BASE_URL: z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
