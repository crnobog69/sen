import type { Config } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'file:./data/sen.db';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN
  }
} satisfies Config;
