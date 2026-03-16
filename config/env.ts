import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
}

const getEnvVar = (key: string): string | undefined => {
  const value = process.env[key];
  if (!value) return undefined;
  return value.replace(/^["']|["']$/g, '');
};

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

const missingEnvVars = requiredEnvVars.filter((envVar) => !getEnvVar(envVar));

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

const env = {
  NODE_ENV: getEnvVar('NODE_ENV') || 'development',
  PORT: parseInt(getEnvVar('PORT') || '3000', 10),

  DATABASE_URL: getEnvVar('DATABASE_URL')!,

  JWT_SECRET: getEnvVar('JWT_SECRET')!,
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN') || '7d',

  CORS_ORIGIN: getEnvVar('CORS_ORIGIN') || 'http://localhost:3000',

  PUBLIC_API_URL: getEnvVar('PUBLIC_API_URL'),

  RATE_LIMIT_WINDOW_MS: parseInt(
    getEnvVar('RATE_LIMIT_WINDOW_MS') || '900000',
    10
  ),
  RATE_LIMIT_MAX_REQUESTS: parseInt(
    getEnvVar('RATE_LIMIT_MAX_REQUESTS') || '100',
    10
  ),

  LOG_LEVEL: getEnvVar('LOG_LEVEL') || 'info',

  UPLOAD_DIR: getEnvVar('UPLOAD_DIR') || path.resolve(__dirname, '../public/uploads'),
  MAX_FILE_SIZE: parseInt(getEnvVar('MAX_FILE_SIZE') || '5242880', 10),
} as const;

export default env;
