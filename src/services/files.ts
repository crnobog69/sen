import { and, eq, sql } from 'drizzle-orm';
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
  const contentHash = await hashStoredFileSha256(savedPath);

  try {
    const inserted = await db.transaction(async (tx) => {
      const created = await tx
        .insert(files)
        .values({
          publicId: nanoid(14),
          serverskaPutanja: savedPath,
          folderId: folder.id,
          velicina: size,
          contentHash,
          public: input.isPublic,
          rateLimitOverride: input.rateLimitOverride
        })
        .returning();

      await tx
        .update(folders)
        .set({ quotaUsed: sql`${folders.quotaUsed} + ${size}` })
        .where(eq(folders.id, folder.id));

      return created[0];
    });

    return inserted;
  } catch (error) {
    await deleteStoredFile(savedPath);
    throw error;
  }
}

export async function deleteFileRecord(fileId: number) {
  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file) {
    throw new FileNotFoundError('Фајл не постоји.');
  }

  await db.transaction(async (tx) => {
    await tx.delete(files).where(eq(files.id, file.id));
    await tx
      .update(folders)
      .set({
        quotaUsed: sql`CASE WHEN ${folders.quotaUsed} - ${file.velicina} < 0 THEN 0 ELSE ${folders.quotaUsed} - ${file.velicina} END`
      })
      .where(eq(folders.id, file.folderId));
  });

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

export async function folderContainsFile(folderId: number) {
  const row = await db.query.files.findFirst({ where: eq(files.folderId, folderId) });
  return Boolean(row);
}

export async function existsFolderById(folderId: number) {
  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  return folder;
}

export async function belongsToFolder(fileId: number, folderId: number) {
  const row = await db.query.files.findFirst({ where: and(eq(files.id, fileId), eq(files.folderId, folderId)) });
  return Boolean(row);
}
