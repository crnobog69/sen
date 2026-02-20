import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { db } from '../db/client.ts';
import { apiKeys } from '../db/schema.ts';
import { hashApiKey } from '../services/api-keys.ts';
import type { AppBindings } from '../types.ts';

export const apiKeyAuth = createMiddleware<AppBindings>(async (c, next) => {
  const raw = c.req.header('X-API-Key') ?? c.req.header('x-api-key');
  if (!raw) {
    return c.json({ greska: 'Недостаје X-API-Key header.' }, 401);
  }

  const hashed = hashApiKey(raw);
  let key = await db.query.apiKeys.findFirst({ where: eq(apiKeys.key, hashed) });

  if (!key) {
    const legacy = await db.query.apiKeys.findFirst({ where: eq(apiKeys.key, raw) });
    if (legacy) {
      const upgraded = await db
        .update(apiKeys)
        .set({ key: hashed })
        .where(eq(apiKeys.id, legacy.id))
        .returning();
      key = upgraded[0] ?? legacy;
    }
  }

  if (!key) {
    return c.json({ greska: 'Неважећи АПИ кључ.' }, 401);
  }

  c.set('apiKey', key);
  await next();
});
