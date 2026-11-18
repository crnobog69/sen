import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client.ts';
import { files } from '../db/schema.ts';
import { findApiKey } from '../middleware/api-key-auth.ts';
import { enforceRateLimit } from '../services/rate-limit.ts';

export const publicRoutes = new Hono();

publicRoutes.get('/f/:public_id', async (c) => {
  const rawKey = c.req.header('X-API-Key');
  c.header('Vary', 'X-API-Key', { append: true });
  if (rawKey !== undefined) c.header('Cache-Control', 'private, no-store');

  const publicId = c.req.param('public_id');

  const file = await db.query.files.findFirst({
    where: and(eq(files.publicId, publicId), eq(files.public, true))
  });

  if (!file) {
    return c.json({ greska: 'Фајл није пронађен.' }, 404);
  }

  const apiKey = rawKey === undefined ? undefined : await findApiKey(rawKey);
  if (rawKey !== undefined && !apiKey) {
    return c.json({ greska: 'Неважећи АПИ кључ.' }, 401);
  }

  const limited = await enforceRateLimit(c, { file, apiKey });
  if (limited) {
    return limited;
  }

  const payload = Bun.file(file.serverskaPutanja);
  if (!(await payload.exists())) {
    return c.json({ greska: 'Фајл не постоји на диску.' }, 404);
  }

  if (!apiKey) c.header('Cache-Control', 'public, max-age=31536000, immutable');
  if (file.contentHash) {
    c.header('ETag', `"sha256-${file.contentHash}"`);
  }
  return c.newResponse(payload.stream(), 200, {
    'Content-Type': payload.type || 'application/octet-stream'
  });
});
