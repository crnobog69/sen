import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { apiKeyAuth } from '../middleware/api-key-auth.ts';
import { db } from '../db/client.ts';
import { files, folders } from '../db/schema.ts';
import {
  createFileRecord,
  deleteFileRecord,
  FileNotFoundError,
  FolderNotFoundError,
  QuotaExceededError
} from '../services/files.ts';
import { asBoolean, asNullableNumber } from '../services/format.ts';
import {
  fileAccessibleToApiKey,
  folderAssignedToApiKey,
  listFilesForApiKey
} from '../services/permissions.ts';
import { enforceRateLimit } from '../services/rate-limit.ts';
import type { AppBindings } from '../types.ts';

function parseId(raw: string) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export const privateRoutes = new Hono<AppBindings>();
privateRoutes.use('*', apiKeyAuth);

privateRoutes.get('/files', async (c) => {
  const apiKey = c.get('apiKey');

  const limited = await enforceRateLimit(c, { apiKeyId: apiKey.id });
  if (limited) {
    return limited;
  }

  const data = await listFilesForApiKey(apiKey.id);
  return c.json(data);
});

privateRoutes.get('/folder/:id', async (c) => {
  const apiKey = c.get('apiKey');
  const folderId = parseId(c.req.param('id'));
  if (!folderId) {
    return c.json({ greska: 'Неважећи ID фолдера.' }, 400);
  }

  const assigned = await folderAssignedToApiKey(apiKey.id, folderId);
  if (!assigned) {
    return c.json({ greska: 'Немате приступ том фолдеру.' }, 403);
  }

  const limited = await enforceRateLimit(c, { folderId, apiKeyId: apiKey.id });
  if (limited) {
    return limited;
  }

  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) {
    return c.json({ greska: 'Фолдер није пронађен.' }, 404);
  }

  const inFolder = await db.query.files.findMany({ where: eq(files.folderId, folderId) });

  return c.json({
    folder,
    files: inFolder
  });
});

privateRoutes.get('/file/:id', async (c) => {
  const apiKey = c.get('apiKey');
  const fileId = parseId(c.req.param('id'));
  if (!fileId) {
    return c.json({ greska: 'Неважећи ID фајла.' }, 400);
  }

  const file = await fileAccessibleToApiKey(apiKey.id, fileId);
  if (!file) {
    return c.json({ greska: 'Фајл није пронађен или није додељен.' }, 404);
  }

  const limited = await enforceRateLimit(c, {
    fileId: file.id,
    folderId: file.folderId,
    apiKeyId: apiKey.id
  });
  if (limited) {
    return limited;
  }

  const payload = Bun.file(file.serverskaPutanja);
  if (!(await payload.exists())) {
    return c.json({ greska: 'Фајл не постоји на диску.' }, 404);
  }

  if (file.contentHash) {
    c.header('ETag', `"sha256-${file.contentHash}"`);
  }
  return c.newResponse(payload.stream(), 200, {
    'Content-Type': payload.type || 'application/octet-stream'
  });
});

privateRoutes.post('/upload/:folder_id', async (c) => {
  const apiKey = c.get('apiKey');
  if (!apiKey.canUpload) {
    return c.json({ greska: 'Овај АПИ кључ нема дозволу за отпремање.' }, 403);
  }

  const folderId = parseId(c.req.param('folder_id'));
  if (!folderId) {
    return c.json({ greska: 'Неважећи ID фолдера.' }, 400);
  }

  const assigned = await folderAssignedToApiKey(apiKey.id, folderId);
  if (!assigned) {
    return c.json({ greska: 'Фолдер није додељен овом АПИ кључу.' }, 403);
  }

  const limited = await enforceRateLimit(c, { folderId, apiKeyId: apiKey.id });
  if (limited) {
    return limited;
  }

  const body = await c.req.parseBody({ all: true });
  const rawFile = body.file;
  const upload = Array.isArray(rawFile) ? rawFile[0] : rawFile;

  if (!(upload instanceof File)) {
    return c.json({ greska: 'Потребан је multipart параметар `file`.' }, 400);
  }

  const isPublic = asBoolean(body.public);
  const rateLimitOverride = asNullableNumber(body.rate_limit_override);

  try {
    const created = await createFileRecord({
      folderId,
      file: upload,
      isPublic,
      rateLimitOverride
    });

    return c.json({ poruka: 'Фајл је сачуван.', file: created }, 201);
  } catch (error) {
    if (error instanceof FolderNotFoundError) {
      return c.json({ greska: error.message }, 404);
    }
    if (error instanceof QuotaExceededError) {
      return c.json({ greska: error.message }, 409);
    }
    return c.json({ greska: 'Грешка при отпремању.' }, 500);
  }
});

privateRoutes.delete('/file/:id', async (c) => {
  const apiKey = c.get('apiKey');
  if (!apiKey.canDelete) {
    return c.json({ greska: 'Овај АПИ кључ нема дозволу за брисање.' }, 403);
  }

  const fileId = parseId(c.req.param('id'));
  if (!fileId) {
    return c.json({ greska: 'Неважећи ID фајла.' }, 400);
  }

  const accessible = await fileAccessibleToApiKey(apiKey.id, fileId);
  if (!accessible) {
    return c.json({ greska: 'Фајл није додељен овом АПИ кључу.' }, 403);
  }

  const limited = await enforceRateLimit(c, {
    fileId: accessible.id,
    folderId: accessible.folderId,
    apiKeyId: apiKey.id
  });
  if (limited) {
    return limited;
  }

  try {
    await deleteFileRecord(fileId);
    return c.json({ poruka: 'Фајл је обрисан.' });
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      return c.json({ greska: error.message }, 404);
    }
    return c.json({ greska: 'Грешка при брисању.' }, 500);
  }
});

privateRoutes.get('/quota/:folder_id', async (c) => {
  const apiKey = c.get('apiKey');
  const folderId = parseId(c.req.param('folder_id'));
  if (!folderId) {
    return c.json({ greska: 'Неважећи ID фолдера.' }, 400);
  }

  const assigned = await folderAssignedToApiKey(apiKey.id, folderId);
  if (!assigned) {
    return c.json({ greska: 'Фолдер није додељен овом АПИ кључу.' }, 403);
  }

  const limited = await enforceRateLimit(c, { folderId, apiKeyId: apiKey.id });
  if (limited) {
    return limited;
  }

  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) {
    return c.json({ greska: 'Фолдер није пронађен.' }, 404);
  }

  return c.json({
    folderId: folder.id,
    quotaMax: folder.quotaMax,
    quotaUsed: folder.quotaUsed,
    quotaFree: Math.max(folder.quotaMax - folder.quotaUsed, 0)
  });
});
