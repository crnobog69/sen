import { getSignedCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { config } from '../config.ts';
import type { AppBindings } from '../types.ts';

function wantsHtml(contentType: string | undefined) {
  return contentType?.includes('text/html') ?? false;
}

export const adminAuth = createMiddleware<AppBindings>(async (c, next) => {
  const flag = await getSignedCookie(c, config.adminCookieSecret, 'sen_admin');
  if (flag !== '1') {
    if (wantsHtml(c.req.header('accept'))) {
      return c.redirect('/admin');
    }
    return c.json({ greska: 'Потребна је admin пријава.' }, 401);
  }

  c.set('admin', true);
  await next();
});
