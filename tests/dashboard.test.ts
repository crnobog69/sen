import { afterAll, expect, mock, spyOn, test } from 'bun:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { serializeSigned } from 'hono/utils/cookie';

const directory = await mkdtemp(path.join(tmpdir(), 'sen-test-'));
process.env.DATABASE_URL = ':memory:';
process.env.UPLOAD_ROOT = path.join(directory, 'uploads');
process.env.ADMIN_COOKIE_SECRET = 'dashboard-test-only';
mock.module('ioredis', () => ({ default: class {
  private counters = new Map<string, number>();

  incr(key: string) {
    const count = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, count);
    return count;
  }

  expire() {}

  pipeline() {
    const commands: Array<() => unknown> = [];
    return {
      get: (key: string) => commands.push(() => this.counters.get(key)),
      incr: (key: string) => commands.push(() => this.incr(key)),
      expire() {},
      async exec() { return commands.map(command => [null, command()]); }
    };
  }
} }));
const { db } = await import('../src/db/client');
const { bootstrapDatabase } = await import('../src/db/bootstrap');
const { adminRoutes } = await import('../src/routes/admin');
const { privateRoutes } = await import('../src/routes/private');
const { publicRoutes } = await import('../src/routes/public');
const { createFileRecord, deleteFileRecord, QuotaExceededError, FileNotFoundError } =
  await import('../src/services/files');
await bootstrapDatabase();
afterAll(async () => {
  db.$client.close();
  await rm(directory, { recursive: true, force: true });
});

const app = new Hono().route('/admin', adminRoutes).route('/private', privateRoutes).route('/', publicRoutes);
const cookie = await serializeSigned('sen_admin', '1', process.env.ADMIN_COOKIE_SECRET);

test('large folders and access assignments stay paginated after admin actions', async () => {
  await db.run(sql`INSERT INTO folders (ime, quota_max) VALUES ('large', 100000), ('small', 100), ('empty', 100)`);
  await db.run(sql`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<3052)
    INSERT INTO files(public_id, serverska_putanja, velicina, folder_id)
    SELECT 'f'||n, 'test/'||n, 1, CASE WHEN n=3052 THEN 2 ELSE 1 END FROM seq`);
  await db.run(sql`INSERT INTO api_keys(ime, key) VALUES ('test', 'test-key')`);
  await db.run(sql`INSERT INTO api_key_files(api_key_id, file_id) VALUES(1, 3052)`);
  const dashboard = async (params: string) => {
    const res = await app.request('/admin/dash/content?' + params, { headers: { cookie } });
    expect(res.status).toBe(200);
    return res.text();
  };
  const ids = (html: string) => [...html.matchAll(/data-file-id="(\d+)"/g)].map(m => Number(m[1]));
  expect(ids(await dashboard('folder=1&page=2'))).toEqual(Array.from({length: 50}, (_, i) => 51 + i));
  const last = await dashboard('folder=1&page=999&catalog=62');
  expect(ids(last)).toEqual([3051]);
  expect(last).toContain('max="62" value="62"');
  expect(last).toContain('>3051</span>');
  expect(last).toContain('Одузми #3052');
  expect(ids(await dashboard('folder=2'))).toEqual([3052]);
  expect(ids(await dashboard('folder=3'))).toEqual([]);
  expect(ids(await dashboard('folder=1&page=-3'))[0]).toBe(1);
  const res = await app.request('/admin/file/3051', {
    method: 'PATCH', body: new URLSearchParams({public: '1'}),
    headers: {cookie, 'HX-Request': 'true', 'HX-Current-URL': 'http://localhost/admin/dash?folder=1&page=62&catalog=62'},
  });
  expect(res.status).toBe(200);
  expect(ids(await res.text())).toEqual([3051]);
  await db.run(sql`DELETE FROM files WHERE id=3051`);
  expect(ids(await dashboard('folder=1&page=62'))[0]).toBe(3001);
});

test('public downloads honor a supplied API key, and partial edits preserve its override', async () => {
  const clock = spyOn(Date, 'now').mockReturnValue(60_100);
  try {
    const created = await app.request('/admin/apikey', {
      method: 'POST', headers: { cookie },
      body: new URLSearchParams({ ime: 'rate-test', can_upload: '1', can_delete: '1', rate_limit_override: '5' })
    });
    expect(created.status).toBe(201);
    const { key } = await created.json();
    const [apiKey] = await db.all<{ id: number }>(sql`SELECT id FROM api_keys WHERE ime='rate-test'`);
    const patchKey = (fields: Record<string, unknown>) => app.request('/admin/apikey/' + apiKey.id, {
      method: 'PATCH', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(fields)
    });
    expect((await patchKey({ can_upload: 1 })).status).toBe(200);
    expect((await patchKey({ rate_limit_override: 'invalid' })).status).toBe(400);

    await db.run(sql`UPDATE settings SET global_rate_limit=1 WHERE id=1`);
    const uploadPath = path.join(directory, 'test-audio.txt');
    await Bun.write(uploadPath, 'public file');
    await db.run(sql`INSERT INTO folders (id, ime, quota_max) VALUES (100, 'rate-folder', 1000)`);
    await db.run(sql`INSERT INTO api_key_folders (api_key_id, folder_id) VALUES (${apiKey.id}, 100)`);
    await db.run(sql`INSERT INTO files (id, public_id, serverska_putanja, folder_id, velicina, public)
      VALUES (10000, 'rate-file', ${uploadPath}, 100, 11, 1),
             (10001, 'private-rate-file', ${uploadPath}, 100, 11, 0)`);

    const headers = { 'X-API-Key': key };
    const privateList = await app.request('/private/files', { headers });
    expect(privateList.status).toBe(200);
    expect(privateList.headers.get('X-RateLimit-Remaining')).toBe('4');
    const publicWithKey = await app.request('/f/rate-file', { headers });
    expect(publicWithKey.status).toBe(200);
    expect(await publicWithKey.text()).toBe('public file');
    expect(publicWithKey.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(publicWithKey.headers.get('X-RateLimit-Scope')).toBe('api');
    expect(publicWithKey.headers.get('X-RateLimit-Remaining')).toBe('3');
    expect(publicWithKey.headers.get('Cache-Control')).toBe('private, no-store');
    for (let i = 0; i < 3; i++) {
      expect((await app.request('/private/files', { headers })).status).toBe(200);
    }
    const cappedByKey = await app.request('/f/rate-file', { headers });
    expect(cappedByKey.status).toBe(429);
    expect(cappedByKey.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(cappedByKey.headers.get('X-RateLimit-Scope')).toBe('api');

    const anonymous = await app.request('/f/rate-file');
    expect(anonymous.status).toBe(200);
    expect(await anonymous.text()).toBe('public file');
    expect(anonymous.headers.get('X-RateLimit-Scope')).toBe('global');
    expect(anonymous.headers.get('Vary')).toContain('X-API-Key');
    const rateLimited = await app.request('/f/rate-file');
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.headers.get('Retry-After')).toBe('60');
    expect((await app.request('/f/rate-file', { headers: { 'X-API-Key': 'invalid' } })).status).toBe(401);
    expect((await app.request('/f/private-rate-file', { headers })).status).toBe(404);

    await db.run(sql`UPDATE folders SET rate_limit_override=3 WHERE id=100`);
    expect((await app.request('/private/quota/100', { headers })).headers.get('X-RateLimit-Scope')).toBe('folder');
    await db.run(sql`UPDATE files SET rate_limit_override=2 WHERE id=10000`);
    const privateDownload = await app.request('/private/file/10000', { headers });
    expect(privateDownload.headers.get('X-RateLimit-Scope')).toBe('file');
    expect(await privateDownload.text()).toBe('public file');

    expect((await patchKey({ rate_limit_override: 0 })).status).toBe(200);
    const blocked = await app.request('/private/files', { headers });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('0');
    expect((await patchKey({ rate_limit_override: null })).status).toBe(200);
    expect((await app.request('/private/files', { headers })).headers.get('X-RateLimit-Scope')).toBe('global');
    const [permissions] = await db.all<{ can_delete: number }>(sql`SELECT can_delete FROM api_keys WHERE id=${apiKey.id}`);
    expect(permissions.can_delete).toBe(1);
  } finally {
    clock.mockRestore();
  }
});

test('simultaneous uploads and repeat deletes keep the folder quota accurate', async () => {
  await db.run(sql`INSERT INTO folders (id, ime, quota_max) VALUES (101, 'quota-race', 100)`);
  const upload = (name: string, size: number) => createFileRecord({
    folderId: 101, file: new File(['x'.repeat(size)], name), isPublic: false, rateLimitOverride: null
  });

  const uploads = await Promise.allSettled([upload('one.txt', 60), upload('two.txt', 60)]);
  const accepted = uploads.filter(result => result.status === 'fulfilled');
  const rejected = uploads.filter(result => result.status === 'rejected');
  expect(accepted).toHaveLength(1);
  expect(rejected[0].reason).toBeInstanceOf(QuotaExceededError);
  expect(await readdir(path.join(directory, 'uploads', 'quota-race'))).toHaveLength(1);

  const keep = await upload('keep.txt', 25);
  const deletions = await Promise.allSettled([
    deleteFileRecord(accepted[0].value.id), deleteFileRecord(accepted[0].value.id)
  ]);
  expect(deletions.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(deletions.find(result => result.status === 'rejected')?.reason).toBeInstanceOf(FileNotFoundError);
  const [folder] = await db.all<{ quota_used: number }>(sql`SELECT quota_used FROM folders WHERE id=101`);
  expect(folder.quota_used).toBe(25);
  expect((await app.request('/admin/folder/101', { method: 'DELETE', headers: { cookie } })).status).toBe(409);
  await deleteFileRecord(keep.id);
  expect((await app.request('/admin/folder/101', { method: 'DELETE', headers: { cookie } })).status).toBe(200);
});
