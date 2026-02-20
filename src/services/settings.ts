import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { settings } from '../db/schema.ts';

export async function readSettings() {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (!row) {
    throw new Error('Подешавања нису иницијализована');
  }
  return row;
}
