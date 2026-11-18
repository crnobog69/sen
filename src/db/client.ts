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
  connectTimeout: 2_000,
  commandTimeout: 2_000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  autoResendUnfulfilledCommands: false
});

export class RedisUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Redis is unavailable', { cause });
  }
}

export async function withRedis<T>(run: (connection: Redis) => Promise<T>): Promise<T> {
  if (redis.status !== 'ready') throw new RedisUnavailableError();

  try {
    return await run(redis);
  } catch (error) {
    throw new RedisUnavailableError(error);
  }
}
