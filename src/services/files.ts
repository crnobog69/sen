import { and, eq, exists, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.ts';
import { files, folders } from '../db/schema.ts';
import { deleteStoredFile, hashStoredFileSha256, writeUpload } from './storage.ts';

export class FolderNotFoundError extends Error {}
export class QuotaExceededError extends Error {}
export class FileNotFoundError extends Error {}

export async function createFileRecord(input: {
  folderId: number;
  file: File;
  isPublic: boolean;
  rateLimitOverride: number | null;
}) {
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, input.folderId) });
  if (!folder) {
    throw new FolderNotFoundError('Фолдер не постоји.');
  }

  const size = input.file.size;
  if (folder.quotaUsed + size > folder.quotaMax) {
    throw new QuotaExceededError('Квота је прекорачена.');
  }

  const savedPath = await writeUpload(folder.ime, input.file);
  try {
    const contentHash = await hashStoredFileSha256(savedPath);
    const publicId = nanoid(14);
    const eligible = db.select({
      id: sql<number>`NULL`.as('id'),
      publicId: sql<string>`${publicId}`.as('public_id'),
      serverskaPutanja: sql<string>`${savedPath}`.as('serverska_putanja'),
      folderId: folders.id,
      velicina: sql<number>`${size}`.as('velicina'),
      contentHash: sql<string>`${contentHash}`.as('content_hash'),
      public: sql<boolean>`${Number(input.isPublic)}`.as('public'),
      rateLimitOverride: sql<number | null>`${input.rateLimitOverride}`.as('rate_limit_override')
    }).from(folders).where(and(
      eq(folders.id, folder.id),
      sql`${folders.quotaUsed} + ${size} <= ${folders.quotaMax}`
    ));
    const inserted = db.select({ id: files.id }).from(files).where(eq(files.publicId, publicId));
    const [[created]] = await db.batch([
      db.insert(files).select(eligible).returning(),
      db.update(folders)
        .set({ quotaUsed: sql`${folders.quotaUsed} + ${size}` })
        .where(and(eq(folders.id, folder.id), exists(inserted)))
    ]);
    if (created) return created;

    const existingFolder = await db.query.folders.findFirst({ where: eq(folders.id, folder.id) });
    if (!existingFolder) throw new FolderNotFoundError('Фолдер не постоји.');
    throw new QuotaExceededError('Квота је прекорачена.');
  } catch (error) {
    await deleteStoredFile(savedPath).catch(cleanupError => {
      console.error('Грешка при чишћењу неуспешног отпремања:', cleanupError);
    });
    throw error;
  }
}

export async function deleteFileRecord(fileId: number) {
  const size = db.select({ size: files.velicina }).from(files).where(eq(files.id, fileId));
  const folderId = db.select({ id: files.folderId }).from(files).where(eq(files.id, fileId));
  const [, [file]] = await db.batch([
    db.update(folders)
      .set({ quotaUsed: sql`MAX(0, ${folders.quotaUsed} - (${size}))` })
      .where(sql`${folders.id} = (${folderId})`),
    db.delete(files).where(eq(files.id, fileId)).returning()
  ]);
  if (!file) throw new FileNotFoundError('Фајл не постоји.');

  try {
    await deleteStoredFile(file.serverskaPutanja);
  } catch (error) {
    console.error('Грешка при брисању са диска:', error);
  }

  return file;
}

export async function updateFileMeta(fileId: number, input: { isPublic?: boolean; rateLimitOverride?: number | null }) {
  const payload: Partial<typeof files.$inferInsert> = {};

  if (input.isPublic !== undefined) {
    payload.public = input.isPublic;
  }
  if (input.rateLimitOverride !== undefined) {
    payload.rateLimitOverride = input.rateLimitOverride;
  }

  const updated = await db.update(files).set(payload).where(eq(files.id, fileId)).returning();
  return updated[0] ?? null;
}

export async function existsFolderById(folderId: number) {
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  return folder;
}

export async function belongsToFolder(fileId: number, folderId: number) {
  const row = await db.query.files.findFirst({ where: and(eq(files.id, fileId), eq(files.folderId, folderId)) });
  return Boolean(row);
}
