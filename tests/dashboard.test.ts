import { expect, mock, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { serializeSigned } from 'hono/utils/cookie';

test('large folders and access assignments stay paginated after admin actions', async () => {
  process.env.DATABASE_URL = ':memory:';
  process.env.ADMIN_COOKIE_SECRET = 'dashboard-test-only';
  mock.module('ioredis', () => ({ default: class {
    pipeline() { return { get() {}, async exec() { return []; } }; }
  } }));
  const { db } = await import('../src/db/client');
  const { bootstrapDatabase } = await import('../src/db/bootstrap');
  const { adminRoutes } = await import('../src/routes/admin');
  await bootstrapDatabase();
  await db.run(sql`INSERT INTO folders (ime, quota_max) VALUES ('large', 100000), ('small', 100), ('empty', 100)`);
  await db.run(sql`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<3052)
    INSERT INTO files(public_id, serverska_putanja, velicina, folder_id)
    SELECT 'f'||n, 'test/'||n, 1, CASE WHEN n=3052 THEN 2 ELSE 1 END FROM seq`);
  await db.run(sql`INSERT INTO api_keys(ime, key) VALUES ('test', 'test-key')`);
  await db.run(sql`INSERT INTO api_key_files(api_key_id, file_id) VALUES(1, 3052)`);
  const app = new Hono().route('/admin', adminRoutes);
  const cookie = await serializeSigned('sen_admin', '1', process.env.ADMIN_COOKIE_SECRET);
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
