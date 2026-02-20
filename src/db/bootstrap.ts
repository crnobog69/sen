import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, isNull } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { config } from '../config.ts';
import { hashApiKey, isHashedApiKey } from '../services/api-keys.ts';
import { hashStoredFileSha256 } from '../services/storage.ts';
import { db } from './client.ts';
import { apiKeys, files, settings } from './schema.ts';

async function ensureSqlitePathExists() {
  if (!config.databaseUrl.startsWith('file:')) {
    return;
  }
  const raw = config.databaseUrl.slice('file:'.length);
  const dbPath = path.resolve(raw);
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
}

async function tightenSqlitePermissions() {
  if (!config.databaseUrl.startsWith('file:')) {
    return;
  }

  const raw = config.databaseUrl.slice('file:'.length);
  const dbPath = path.resolve(raw);
  const dbDir = path.dirname(dbPath);

  try {
    await fs.chmod(dbDir, 0o700);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT' && err.code !== 'EPERM') {
      throw error;
    }
  }

  try {
    await fs.chmod(dbPath, 0o600);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT' && err.code !== 'EPERM') {
      throw error;
    }
  }
}

async function migrateApiKeysToHash() {
  const rows = await db
    .select({
      id: apiKeys.id,
      key: apiKeys.key
    })
    .from(apiKeys);

  for (const row of rows) {
    if (isHashedApiKey(row.key)) {
      continue;
    }
    await db
      .update(apiKeys)
      .set({ key: hashApiKey(row.key) })
      .where(eq(apiKeys.id, row.id));
  }
}

async function backfillFileContentHashes() {
  const rows = await db
    .select({
      id: files.id,
      serverskaPutanja: files.serverskaPutanja
    })
    .from(files)
    .where(isNull(files.contentHash));

  for (const row of rows) {
    try {
      const hash = await hashStoredFileSha256(row.serverskaPutanja);
      await db
        .update(files)
        .set({ contentHash: hash })
        .where(eq(files.id, row.id));
    } catch (error) {
      console.warn(`Није могуће израчунати hash за фајл #${row.id}:`, error);
    }
  }
}

export async function bootstrapDatabase() {
  await ensureSqlitePathExists();
  await migrate(db, { migrationsFolder: './drizzle' });
  await migrateApiKeysToHash();
  await backfillFileContentHashes();
  await tightenSqlitePermissions();

  await db
    .insert(settings)
    .values({
      id: 1,
      globalRateLimit: config.globalRateLimitDefault,
      globalDefaultQuota: config.defaultFolderQuotaBytes
    })
    .onConflictDoNothing();
}
