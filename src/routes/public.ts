import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client.ts';
import { files } from '../db/schema.ts';
import { enforceRateLimit } from '../services/rate-limit.ts';

export const publicRoutes = new Hono();

publicRoutes.get('/f/:public_id', async (c) => {
  const publicId = c.req.param('public_id');

  const file = await db.query.files.findFirst({
    where: and(eq(files.publicId, publicId), eq(files.public, true))
  });

  if (!file) {
    return c.json({ greska: 'Фајл није пронађен.' }, 404);
  }

  const limited = await enforceRateLimit(c, { fileId: file.id, folderId: file.folderId });
  if (limited) {
    return limited;
  }

  const payload = Bun.file(file.serverskaPutanja);
  if (!(await payload.exists())) {
    return c.json({ greska: 'Фајл не постоји на диску.' }, 404);
  }

  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  if (file.contentHash) {
    c.header('ETag', `"sha256-${file.contentHash}"`);
  }
  return c.newResponse(payload.stream(), 200, {
    'Content-Type': payload.type || 'application/octet-stream'
  });
});
