import path from 'node:path';
import { and, count, eq, inArray, lte, notExists } from 'drizzle-orm';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { nanoid } from 'nanoid';
import { config } from '../config.ts';
import { db, redis } from '../db/client.ts';
import { adminAuth } from '../middleware/admin-auth.ts';
import {
  apiKeyFiles,
  apiKeyFolders,
  apiKeys,
  files,
  folders,
  settings
} from '../db/schema.ts';
import {
  createFileRecord,
  deleteFileRecord,
  FileNotFoundError,
  FolderNotFoundError,
  QuotaExceededError,
  updateFileMeta
} from '../services/files.ts';
import { hashApiKey } from '../services/api-keys.ts';
import { asBoolean, asNullableNumber, parseRateLimitOverride } from '../services/format.ts';
import { readTrafficStats } from '../services/rate-limit.ts';
import { readSettings } from '../services/settings.ts';
import type { AppBindings } from '../types.ts';
import {
  renderAdminLogin,
  renderDashboardContent,
  renderDashboardPage,
  type DashboardData
} from '../ui/admin.ts';

function parseId(raw: string) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

const BYTES_IN_GB = 1024 ** 3;
const ADMIN_LOGIN_MAX_ATTEMPTS = 8;
const ADMIN_LOGIN_WINDOW_SECONDS = 15 * 60;
const ADMIN_LOGIN_BLOCK_SECONDS = 30 * 60;
const INVALID_RATE_LIMIT = 'Лимит мора бити цео број већи или једнак нули или празно поље.';

const ADMIN_LOGIN_KEY = {
  fail: (ip: string) => `admin:login:fail:${ip}`,
  block: (ip: string) => `admin:login:block:${ip}`
};

function clientAddress(c: Context<AppBindings>) {
  const forwarded = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip');
  if (!forwarded) {
    return 'unknown';
  }
  return forwarded.split(',')[0]?.trim() || 'unknown';
}

function wantsHtml(c: Context<AppBindings>) {
  return (c.req.header('accept') ?? '').includes('text/html');
}

function loginError(
  c: Context<AppBindings>,
  message: string,
  status: ContentfulStatusCode,
  retryAfterSeconds?: number
) {
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    c.header('Retry-After', String(retryAfterSeconds));
  }

  if (wantsHtml(c)) {
    return c.html(renderAdminLogin(message), status);
  }

  return c.json({ greska: message }, status);
}

async function getLoginBlockSeconds(ip: string) {
  const ttl = await redis.ttl(ADMIN_LOGIN_KEY.block(ip));
  if (ttl > 0) {
    return ttl;
  }
  return null;
}

async function registerFailedLogin(ip: string) {
  const failKey = ADMIN_LOGIN_KEY.fail(ip);
  const attempts = await redis.incr(failKey);
  if (attempts === 1) {
    await redis.expire(failKey, ADMIN_LOGIN_WINDOW_SECONDS);
  }

  if (attempts >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    await redis.set(ADMIN_LOGIN_KEY.block(ip), '1', 'EX', ADMIN_LOGIN_BLOCK_SECONDS);
    await redis.del(failKey);
    return ADMIN_LOGIN_BLOCK_SECONDS;
  }

  return null;
}

async function clearLoginGuard(ip: string) {
  await redis.del(ADMIN_LOGIN_KEY.fail(ip), ADMIN_LOGIN_KEY.block(ip));
}

function gbToBytes(input: unknown): number | null {
  if (input === undefined || input === null || input === '') {
    return null;
  }
  const gb = Number(input);
  if (!Number.isFinite(gb) || gb < 0) {
    return null;
  }
  return Math.floor(gb * BYTES_IN_GB);
}

function isHx(c: Context<AppBindings>) {
  return c.req.header('HX-Request') === 'true';
}

const PAGE_SIZE = 50;

function filePage(raw: string | null, total: number) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parseId(raw ?? '') ?? 1, pages);
  return { page, pages };
}

async function loadDashboardData(params: URLSearchParams): Promise<DashboardData> {
  const [settingsRow, foldersRows, counts, keyRows, keyFoldersRows] = await Promise.all([
    readSettings(),
    db.select().from(folders).orderBy(folders.id),
    db.select({ folderId: files.folderId, total: count() }).from(files).groupBy(files.folderId),
    db.select().from(apiKeys),
    db.select().from(apiKeyFolders)
  ]);
  const totals = new Map(counts.map((row) => [row.folderId, row.total]));
  const selectedFolder = foldersRows.find((f) => f.id === Number(params.get('folder'))) ?? foldersRows[0];
  const folderPage = filePage(params.get('page'), totals.get(selectedFolder?.id ?? 0) ?? 0);
  const catalogPage = filePage(params.get('catalog'), counts.reduce((sum, row) => sum + row.total, 0));

  const listFiles = (page: number, folderId?: number) =>
    db
      .select({
        id: files.id,
        publicId: files.publicId,
        serverskaPutanja: files.serverskaPutanja,
        folderId: files.folderId,
        folderIme: folders.ime,
        velicina: files.velicina,
        contentHash: files.contentHash,
        public: files.public,
        rateLimitOverride: files.rateLimitOverride
      })
      .from(files)
      .innerJoin(folders, eq(folders.id, files.folderId))
      .where(folderId === undefined ? undefined : eq(files.folderId, folderId))
      .orderBy(files.id)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

  const [folderFiles, catalogFiles, traffic] = await Promise.all([
    selectedFolder ? listFiles(folderPage.page, selectedFolder.id) : [],
    listFiles(catalogPage.page),
    readTrafficStats(keyRows.map((row) => row.id))
  ]);
  const keyFilesRows = catalogFiles.length ? await db.select().from(apiKeyFiles)
    .where(inArray(apiKeyFiles.fileId, catalogFiles.map((f) => f.id))) : [];

  return {
    settings: {
      globalRateLimit: settingsRow.globalRateLimit,
      globalDefaultQuota: settingsRow.globalDefaultQuota
    },
    folders: foldersRows.map((f) => ({ ...f, fileCount: totals.get(f.id) ?? 0 })),
    selectedFolderId: selectedFolder?.id,
    folderPage,
    catalogPage,
    folderFiles,
    files: catalogFiles,
    apiKeys: keyRows,
    apiKeyFolders: keyFoldersRows,
    apiKeyFiles: keyFilesRows,
    traffic
  };
}

async function htmlDashboard(c: Context<AppBindings>, notice?: DashboardData['notice']) {
  const url = new URL(c.req.url);
  const currentUrl = c.req.header('HX-Current-URL');
  if (notice && currentUrl && URL.canParse(currentUrl)) url.search = new URL(currentUrl).search;
  const data = await loadDashboardData(url.searchParams);
  return renderDashboardContent({ ...data, notice });
}

async function actionResponse(
  c: Context<AppBindings>,
  text: string,
  status: ContentfulStatusCode = 200,
  error = false,
  secret?: string
) {
  if (isHx(c)) {
    return c.html(await htmlDashboard(c, { text, error, secret }), status);
  }
  if (error) {
    return c.json({ greska: text }, status);
  }
  return c.json(secret ? { poruka: text, key: secret } : { poruka: text }, status);
}

export const adminRoutes = new Hono<AppBindings>();

adminRoutes.get('/', async (c) => {
  const auth = await getSignedCookie(c, config.adminCookieSecret, 'sen_admin');
  if (auth === '1') {
    return c.redirect('/admin/dash');
  }
  return c.html(renderAdminLogin());
});

async function handleAdminLogin(c: Context<AppBindings>) {
  const ip = clientAddress(c);
  const blockedSeconds = await getLoginBlockSeconds(ip);
  if (blockedSeconds !== null) {
    const waitMinutes = Math.max(1, Math.ceil(blockedSeconds / 60));
    return loginError(c, `Превише неуспешних покушаја. Покушај поново за ${waitMinutes} минута.`, 429, blockedSeconds);
  }

  const body = await c.req.parseBody();
  const lozinka = String(body.lozinka ?? '');

  if (lozinka !== config.adminPassword) {
    const newBlockSeconds = await registerFailedLogin(ip);
    if (newBlockSeconds !== null) {
      const waitMinutes = Math.max(1, Math.ceil(newBlockSeconds / 60));
      return loginError(c, `Превише неуспешних покушаја. Покушај поново за ${waitMinutes} минута.`, 429, newBlockSeconds);
    }
    return loginError(c, 'Погрешна лозинка.', 401);
  }

  await clearLoginGuard(ip);

  await setSignedCookie(c, 'sen_admin', '1', config.adminCookieSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/admin',
    maxAge: 60 * 60 * 24 * 14
  });

  return c.redirect('/admin/dash');
}

adminRoutes.post('/', handleAdminLogin);
adminRoutes.post('/login', handleAdminLogin);

const secured = new Hono<AppBindings>();
secured.use('*', adminAuth);

secured.post('/logout', async (c) => {
  deleteCookie(c, 'sen_admin', { path: '/admin' });
  return c.redirect('/admin');
});

secured.get('/dash', async (c) => {
  const content = await htmlDashboard(c);
  return c.html(renderDashboardPage(content));
});

secured.get('/dash/content', async (c) => {
  return c.html(await htmlDashboard(c));
});

secured.get('/file/:id/raw', async (c) => {
  const fileId = parseId(c.req.param('id'));
  if (!fileId) {
    return c.json({ greska: 'Неважећи ID фајла.' }, 400);
  }

  const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
  if (!file) {
    return c.json({ greska: 'Фајл није пронађен.' }, 404);
  }

  const payload = Bun.file(file.serverskaPutanja);
  if (!(await payload.exists())) {
    return c.json({ greska: 'Фајл не постоји на диску.' }, 404);
  }

  const fileName = path.basename(file.serverskaPutanja).replaceAll('\"', '');
  if (file.contentHash) {
    c.header('ETag', `"sha256-${file.contentHash}"`);
  }

  return c.newResponse(payload.stream(), 200, {
    'Content-Type': payload.type || 'application/octet-stream',
    'Content-Disposition': `inline; filename=\"${fileName}\"`,
    'Cache-Control': 'no-store'
  });
});

secured.post('/upload', async (c) => {
  const body = await c.req.parseBody({ all: true });

  const folderId = parseId(String(body.folder_id ?? ''));
  if (!folderId) {
    return actionResponse(c, 'Неважећи ID фолдера.', 400, true);
  }

  const rawFile = body.file;
  const upload = Array.isArray(rawFile) ? rawFile[0] : rawFile;
  if (!(upload instanceof File)) {
    return actionResponse(c, 'Потребан је multipart параметар `file`.', 400, true);
  }

  const isPublic = asBoolean(body.public);
  const rateLimitOverride = asNullableNumber(body.rate_limit_override);

  try {
    await createFileRecord({
      folderId,
      file: upload,
      isPublic,
      rateLimitOverride
    });
    return actionResponse(c, 'Фајл је успешно сачуван.');
  } catch (error) {
    if (error instanceof FolderNotFoundError) {
      return actionResponse(c, error.message, 404, true);
    }
    if (error instanceof QuotaExceededError) {
      return actionResponse(c, error.message, 409, true);
    }
    return actionResponse(c, 'Грешка при отпремању.', 500, true);
  }
});

secured.delete('/file/:id', async (c) => {
  const fileId = parseId(c.req.param('id'));
  if (!fileId) {
    return actionResponse(c, 'Неважећи ID фајла.', 400, true);
  }

  try {
    await deleteFileRecord(fileId);
    return actionResponse(c, 'Фајл је обрисан.');
  } catch (error) {
    if (error instanceof FileNotFoundError) {
      return actionResponse(c, error.message, 404, true);
    }
    return actionResponse(c, 'Грешка при брисању.', 500, true);
  }
});

secured.patch('/file/:id', async (c) => {
  const fileId = parseId(c.req.param('id'));
  if (!fileId) {
    return actionResponse(c, 'Неважећи ID фајла.', 400, true);
  }

  const body = await c.req.parseBody();
  const isPublic = body.public === undefined ? undefined : asBoolean(body.public);
  const rateLimitOverride = parseRateLimitOverride(body.rate_limit_override);
  if (body.rate_limit_override !== undefined && rateLimitOverride === undefined) {
    return actionResponse(c, INVALID_RATE_LIMIT, 400, true);
  }
  if (isPublic === undefined && rateLimitOverride === undefined) {
    return actionResponse(c, 'Нема измена за чување.', 400, true);
  }

  const updated = await updateFileMeta(fileId, {
    isPublic,
    rateLimitOverride
  });

  if (!updated) {
    return actionResponse(c, 'Фајл није пронађен.', 404, true);
  }

  return actionResponse(c, 'Измена фајла је сачувана.');
});

secured.post('/folder', async (c) => {
  const body = await c.req.parseBody();
  const ime = String(body.ime ?? '').trim();
  if (!ime) {
    return actionResponse(c, 'Име фолдера је обавезно.', 400, true);
  }

  const settingsRow = await readSettings();
  const quotaMax =
    gbToBytes(body.quota_max_gb) ??
    asNullableNumber(body.quota_max) ??
    settingsRow.globalDefaultQuota;
  const rateLimitOverride = asNullableNumber(body.rate_limit_override);

  try {
    await db.insert(folders).values({
      ime,
      quotaMax,
      quotaUsed: 0,
      rateLimitOverride
    });
  } catch {
    return actionResponse(c, 'Фолдер са тим именом већ постоји.', 409, true);
  }

  return actionResponse(c, 'Фолдер је креиран.');
});

secured.patch('/folder/:id', async (c) => {
  const folderId = parseId(c.req.param('id'));
  if (!folderId) {
    return actionResponse(c, 'Неважећи ID фолдера.', 400, true);
  }

  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) {
    return actionResponse(c, 'Фолдер није пронађен.', 404, true);
  }

  const body = await c.req.parseBody();
  const quotaMaxRaw = gbToBytes(body.quota_max_gb) ?? asNullableNumber(body.quota_max);
  const rateLimitOverride = parseRateLimitOverride(body.rate_limit_override);
  if (body.rate_limit_override !== undefined && rateLimitOverride === undefined) {
    return actionResponse(c, INVALID_RATE_LIMIT, 400, true);
  }

  const payload: Partial<typeof folders.$inferInsert> = {};
  if (quotaMaxRaw !== null) payload.quotaMax = quotaMaxRaw;
  if (rateLimitOverride !== undefined) payload.rateLimitOverride = rateLimitOverride;
  if (Object.keys(payload).length === 0) {
    return actionResponse(c, 'Нема измена за чување.', 400, true);
  }

  const [updated] = await db.update(folders).set(payload).where(and(
    eq(folders.id, folderId),
    quotaMaxRaw === null ? undefined : lte(folders.quotaUsed, quotaMaxRaw)
  )).returning({ id: folders.id });
  if (!updated) {
    return actionResponse(c, 'Нова квота не сме бити мања од већ заузете.', 409, true);
  }
  return actionResponse(c, 'Измена фолдера је сачувана.');
});

secured.delete('/folder/:id', async (c) => {
  const folderId = parseId(c.req.param('id'));
  if (!folderId) {
    return actionResponse(c, 'Неважећи ID фолдера.', 400, true);
  }

  const folder = await db.query.folders.findFirst({ where: eq(folders.id, folderId) });
  if (!folder) {
    return actionResponse(c, 'Фолдер није пронађен.', 404, true);
  }

  const inFolder = db.select({ id: files.id }).from(files).where(eq(files.folderId, folders.id));
  const [removed] = await db.delete(folders)
    .where(and(eq(folders.id, folderId), notExists(inFolder)))
    .returning({ id: folders.id });
  if (!removed) {
    return actionResponse(c, 'Фолдер није празан. Прво обришите фајлове.', 409, true);
  }

  return actionResponse(c, 'Фолдер је обрисан.');
});

secured.post('/apikey', async (c) => {
  const body = await c.req.parseBody();
  const ime = String(body.ime ?? '').trim();
  if (!ime) {
    return actionResponse(c, 'Име АПИ кључа је обавезно.', 400, true);
  }

  const canUpload = asBoolean(body.can_upload);
  const canDelete = asBoolean(body.can_delete);
  const rateLimitOverride = body.rate_limit_override === undefined ? null : parseRateLimitOverride(body.rate_limit_override);
  if (rateLimitOverride === undefined) {
    return actionResponse(c, INVALID_RATE_LIMIT, 400, true);
  }
  const key = `sen_${nanoid(40)}`;
  const keyHash = hashApiKey(key);

  try {
    await db.insert(apiKeys).values({
      ime,
      key: keyHash,
      canUpload,
      canDelete,
      rateLimitOverride
    });
  } catch {
    return actionResponse(c, 'АПИ кључ са тим именом већ постоји.', 409, true);
  }

  return actionResponse(c, 'АПИ кључ је креиран.', 201, false, key);
});

secured.delete('/apikey/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) {
    return actionResponse(c, 'Неважећи ID АПИ кључа.', 400, true);
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  const minute = Math.floor(Date.now() / 60_000);
  await redis.del(
    `traffic:api:${id}:total`,
    `traffic:api:${id}:minute:${minute}`,
    `traffic:api:${id}:minute:${minute - 1}`
  );
  return actionResponse(c, 'АПИ кључ је обрисан.');
});

secured.post('/apikey/:id/revoke', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) {
    return actionResponse(c, 'Неважећи ID АПИ кључа.', 400, true);
  }

  const nextKey = `sen_${nanoid(40)}`;
  const nextKeyHash = hashApiKey(nextKey);
  const updated = await db
    .update(apiKeys)
    .set({ key: nextKeyHash })
    .where(eq(apiKeys.id, id))
    .returning();

  if (updated.length === 0) {
    return actionResponse(c, 'АПИ кључ није пронађен.', 404, true);
  }

  return actionResponse(c, 'АПИ кључ је регенерисан.', 200, false, nextKey);
});

secured.patch('/apikey/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) {
    return actionResponse(c, 'Неважећи ID АПИ кључа.', 400, true);
  }

  const contentType = c.req.header('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  const body = contentType === 'application/json'
    ? await c.req.json<Record<string, unknown>>().catch(() => null)
    : await c.req.parseBody();
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return actionResponse(c, 'Неважећи подаци за измену.', 400, true);
  }

  const payload: Partial<typeof apiKeys.$inferInsert> = {};
  if (body.can_upload !== undefined) payload.canUpload = asBoolean(body.can_upload);
  if (body.can_delete !== undefined) payload.canDelete = asBoolean(body.can_delete);
  if (body.rate_limit_override !== undefined) {
    const rateLimitOverride = parseRateLimitOverride(body.rate_limit_override);
    if (rateLimitOverride === undefined) {
      return actionResponse(c, INVALID_RATE_LIMIT, 400, true);
    }
    payload.rateLimitOverride = rateLimitOverride;
  }
  if (Object.keys(payload).length === 0) {
    return actionResponse(c, 'Нема измена за чување.', 400, true);
  }

  const updated = await db
    .update(apiKeys)
    .set(payload)
    .where(eq(apiKeys.id, id))
    .returning();

  if (updated.length === 0) {
    return actionResponse(c, 'АПИ кључ није пронађен.', 404, true);
  }

  return actionResponse(c, 'Измена АПИ кључа је сачувана.');
});

secured.post('/apikey/:id/folder/:fid', async (c) => {
  const id = parseId(c.req.param('id'));
  const fid = parseId(c.req.param('fid'));
  if (!id || !fid) {
    return actionResponse(c, 'Неважећи параметри.', 400, true);
  }

  try {
    await db.insert(apiKeyFolders).values({ apiKeyId: id, folderId: fid }).onConflictDoNothing();
  } catch {
    return actionResponse(c, 'Фолдер или АПИ кључ не постоји.', 404, true);
  }
  return actionResponse(c, 'Фолдер је додељен АПИ кључу.');
});

secured.delete('/apikey/:id/folder/:fid', async (c) => {
  const id = parseId(c.req.param('id'));
  const fid = parseId(c.req.param('fid'));
  if (!id || !fid) {
    return actionResponse(c, 'Неважећи параметри.', 400, true);
  }

  await db
    .delete(apiKeyFolders)
    .where(and(eq(apiKeyFolders.apiKeyId, id), eq(apiKeyFolders.folderId, fid)));
  return actionResponse(c, 'Фолдер је одузет АПИ кључу.');
});

secured.post('/apikey/:id/file/:fid', async (c) => {
  const id = parseId(c.req.param('id'));
  const fid = parseId(c.req.param('fid'));
  if (!id || !fid) {
    return actionResponse(c, 'Неважећи параметри.', 400, true);
  }

  try {
    await db.insert(apiKeyFiles).values({ apiKeyId: id, fileId: fid }).onConflictDoNothing();
  } catch {
    return actionResponse(c, 'Фајл или АПИ кључ не постоји.', 404, true);
  }
  return actionResponse(c, 'Фајл је додељен АПИ кључу.');
});

secured.delete('/apikey/:id/file/:fid', async (c) => {
  const id = parseId(c.req.param('id'));
  const fid = parseId(c.req.param('fid'));
  if (!id || !fid) {
    return actionResponse(c, 'Неважећи параметри.', 400, true);
  }

  await db
    .delete(apiKeyFiles)
    .where(and(eq(apiKeyFiles.apiKeyId, id), eq(apiKeyFiles.fileId, fid)));
  return actionResponse(c, 'Фајл је одузет АПИ кључу.');
});

secured.patch('/settings', async (c) => {
  const body = await c.req.parseBody();
  const globalRateLimit = asNullableNumber(body.global_rate_limit);
  const globalDefaultQuota =
    gbToBytes(body.global_default_quota_gb) ?? asNullableNumber(body.global_default_quota);

  const payload: Partial<typeof settings.$inferInsert> = {};
  if (globalRateLimit !== null && globalRateLimit > 0) payload.globalRateLimit = globalRateLimit;
  if (globalDefaultQuota !== null) payload.globalDefaultQuota = globalDefaultQuota;

  if (Object.keys(payload).length === 0) {
    return actionResponse(c, 'Нема измена за чување.', 400, true);
  }

  await db.update(settings).set(payload).where(eq(settings.id, 1));
  return actionResponse(c, 'Глобална подешавања су сачувана.');
});

adminRoutes.route('/', secured);
