import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import Redis from 'ioredis';
import { config } from '../config.ts';
import * as schema from './schema.ts';

const client = createClient({
  url: config.databaseUrl,
  authToken: config.databaseAuthToken
});

export const db = drizzle(client, { schema });
export const redis = new Redis(config.redisUrl, {
  lazyConnect: false,
  maxRetriesPerRequest: null
});
