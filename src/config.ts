import path from 'node:path';

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function strEnv(name: string, fallback?: string): string {
  const raw = process.env[name];
  if (raw && raw.length > 0) {
    return raw;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Недостаје env променљива: ${name}`);
}

export const config = {
  host: strEnv('HOST', '0.0.0.0'),
  port: numEnv('PORT', 9995),
  databaseUrl: strEnv('DATABASE_URL', 'file:./data/sen.db'),
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN,
  redisUrl: strEnv('REDIS_URL', 'redis://127.0.0.1:6379'),
  uploadRoot: path.resolve(strEnv('UPLOAD_ROOT', './uploads')),
  globalRateLimitDefault: numEnv('GLOBAL_RATE_LIMIT_DEFAULT', 30),
  defaultFolderQuotaBytes: numEnv('DEFAULT_FOLDER_QUOTA_BYTES', 1_073_741_824),
  adminPassword: strEnv('ADMIN_PASSWORD', 'promeni_me'),
  adminCookieSecret: strEnv('ADMIN_COOKIE_SECRET', 'promeni_me_tajna')
};
