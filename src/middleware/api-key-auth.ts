import { and, eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { db } from '../db/client.ts';
import { apiKeys } from '../db/schema.ts';
import { hashApiKey, isHashedApiKey } from '../services/api-keys.ts';
import type { AppBindings } from '../types.ts';

export async function findApiKey(raw: string) {
  if (!raw || isHashedApiKey(raw)) return undefined;
  const hashed = hashApiKey(raw);
  const key = await db.query.apiKeys.findFirst({ where: eq(apiKeys.key, hashed) });
  if (key) return key;

  const legacy = await db.query.apiKeys.findFirst({ where: eq(apiKeys.key, raw) });
  if (!legacy) return undefined;

  const [upgraded] = await db
    .update(apiKeys)
    .set({ key: hashed })
    .where(and(eq(apiKeys.id, legacy.id), eq(apiKeys.key, raw)))
    .returning();
  return upgraded ?? db.query.apiKeys.findFirst({ where: and(eq(apiKeys.id, legacy.id), eq(apiKeys.key, hashed)) });
}

export const apiKeyAuth = createMiddleware<AppBindings>(async (c, next) => {
  const raw = c.req.header('X-API-Key');
  if (!raw) {
    return c.json({ greska: 'Недостаје X-API-Key header.' }, 401);
  }

  const key = await findApiKey(raw);
  if (!key) {
    return c.json({ greska: 'Неважећи АПИ кључ.' }, 401);
  }

  c.set('apiKey', key);
  await next();
});
