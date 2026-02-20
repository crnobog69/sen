import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { apiKeyFiles, apiKeyFolders, files, folders } from '../db/schema.ts';

export async function folderAssignedToApiKey(apiKeyId: number, folderId: number) {
  const row = await db.query.apiKeyFolders.findFirst({
    where: and(eq(apiKeyFolders.apiKeyId, apiKeyId), eq(apiKeyFolders.folderId, folderId))
  });
  return Boolean(row);
}

export async function directFileAssignedToApiKey(apiKeyId: number, fileId: number) {
  const row = await db.query.apiKeyFiles.findFirst({
    where: and(eq(apiKeyFiles.apiKeyId, apiKeyId), eq(apiKeyFiles.fileId, fileId))
  });
  return Boolean(row);
}

export async function fileAccessibleToApiKey(apiKeyId: number, fileId: number) {
  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file) {
    return null;
  }

  const direct = await directFileAssignedToApiKey(apiKeyId, fileId);
  if (direct) {
    return file;
  }

  const throughFolder = await folderAssignedToApiKey(apiKeyId, file.folderId);
  if (throughFolder) {
    return file;
  }

  return null;
}

export async function listFilesForApiKey(apiKeyId: number) {
  const folderRows = await db
    .select({ id: apiKeyFolders.folderId })
    .from(apiKeyFolders)
    .where(eq(apiKeyFolders.apiKeyId, apiKeyId));

  const folderIds = folderRows.map((row) => row.id);

  const directRows = await db
    .select({
      id: files.id,
      publicId: files.publicId,
      serverskaPutanja: files.serverskaPutanja,
      folderId: files.folderId,
      velicina: files.velicina,
      contentHash: files.contentHash,
      public: files.public,
      rateLimitOverride: files.rateLimitOverride
    })
    .from(files)
    .innerJoin(apiKeyFiles, eq(apiKeyFiles.fileId, files.id))
    .where(eq(apiKeyFiles.apiKeyId, apiKeyId));

  let folderRowsFiles: typeof directRows = [];
  if (folderIds.length > 0) {
    folderRowsFiles = await db
      .select({
        id: files.id,
        publicId: files.publicId,
        serverskaPutanja: files.serverskaPutanja,
        folderId: files.folderId,
        velicina: files.velicina,
        contentHash: files.contentHash,
        public: files.public,
        rateLimitOverride: files.rateLimitOverride
      })
      .from(files)
      .where(inArray(files.folderId, folderIds));
  }

  const unique = new Map<number, (typeof directRows)[number]>();
  for (const row of [...directRows, ...folderRowsFiles]) {
    unique.set(row.id, row);
  }

  const foldersAssigned = folderIds.length
    ? await db.select().from(folders).where(inArray(folders.id, folderIds))
    : [];

  return {
    folders: foldersAssigned,
    files: [...unique.values()]
  };
}

export async function fileWithFolder(fileId: number) {
  const row = await db
    .select({
      id: files.id,
      publicId: files.publicId,
      serverskaPutanja: files.serverskaPutanja,
      folderId: files.folderId,
      velicina: files.velicina,
      contentHash: files.contentHash,
      public: files.public,
      rateLimitOverride: files.rateLimitOverride,
      folderIme: folders.ime
    })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(eq(files.id, fileId))
    .limit(1);

  return row[0] ?? null;
}
