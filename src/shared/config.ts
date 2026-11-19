import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from project root .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters in length'),
  JWT_EXPIRES_IN: z.string().default('60m'),
  CORS_ORIGIN: z.string().default('*'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(16).default(12),
  COMPANY_NAME: z.string().default('TeleBill Pro Telecom Services Ltd.'),
  COMPANY_GSTIN: z.string().default('29AABCT1234F1Z5'),
  COMPANY_ADDRESS: z.string().default('Tower B, Silicon Gateway, Bengaluru, India'),
  COMPANY_PHONE: z.string().default('+91-80-45678900'),
  COMPANY_EMAIL: z.string().default('billing@telebill.local'),
  TAX_RATE_PERCENT: z.coerce.number().default(18.0),
  INVOICE_STORAGE_DIR: z.string().default('./storage/invoices'),
  CDR_UPLOAD_DIR: z.string().default('./storage/cdr'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Invalid application environment configuration:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;
