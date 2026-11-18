import path from 'node:path';
import { Hono } from 'hono';
import { config } from './config.ts';
import { bootstrapDatabase } from './db/bootstrap.ts';
import { redis } from './db/client.ts';
import { adminRoutes } from './routes/admin.ts';
import { privateRoutes } from './routes/private.ts';
import { publicRoutes } from './routes/public.ts';
import { ensureUploadRoot } from './services/storage.ts';

const app = new Hono();

function renderLandingPage() {
  return `<!doctype html>
<html lang="sr-Cyrl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SEN</title>
    <style>
      @font-face {
        font-family: "Geist Pixel Square";
        src: url('/assets/fonts/geist/square.woff2') format('woff2');
        font-display: swap;
      }

      :root {
        color-scheme: dark;
        --bg: #0a0e16;
        --surface: #121827;
        --line: #2a3348;
        --text: #ecf1ff;
        --muted: #9aa6be;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1rem;
        background:
          radial-gradient(780px 430px at 100% -10%, #1d2940 0%, rgba(29, 41, 64, 0) 60%),
          radial-gradient(680px 420px at -10% -20%, #161f31 0%, rgba(22, 31, 49, 0) 60%),
          var(--bg);
        color: var(--text);
        font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .hero {
        width: min(860px, 100%);
        border: 1px solid var(--line);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(19, 25, 38, .95), rgba(13, 18, 28, .96));
        padding: clamp(1rem, 2.5vw, 2rem);
      }

      h1 {
        margin: 0;
        font-family: "Geist Pixel Square", "JetBrains Mono", monospace;
        font-size: clamp(3rem, 16vw, 10rem);
        line-height: .9;
        letter-spacing: .01em;
        font-weight: 900;
        font-style: italic;
      }

      p {
        margin: .85rem 0 0;
        max-width: 56ch;
        color: var(--muted);
        line-height: 1.6;
      }

      .actions {
        margin-top: 1rem;
        display: flex;
        flex-wrap: wrap;
        gap: .55rem;
      }

      a {
        border: 1px solid var(--line);
        color: var(--text);
        text-decoration: none;
        border-radius: 10px;
        padding: .52rem .82rem;
        background: var(--surface);
        font-size: .92rem;
      }

      a:hover {
        border-color: #3a4660;
      }
    </style>
  </head>
  <body>
    <main class="hero">
      <h1>SEN</h1>
      <p>„Сен“ је назив изведен из српске речи „сенка“.</p>
      <p>Овај CDN је намењен искључиво за сврхе CRNBG.ORG.</p>
      <p>Изворни код је доступан на <a href="https://github.com/crnobog69/sen">GitHub-у</a>.</p>
      <p>Други могу да затраже API кључ путем: <a href="mailto:admin@crnbg.org">admin@crnbg.org</a>.</p>
      <div class="actions">
        <a href="/admin">Админ панел</a>
        <a href="/admin/dash">Контролна табла</a>
      </div>
    </main>
  </body>
</html>`;
}

app.get('/', (c) => {
  const accept = c.req.header('accept') ?? '';
  if (accept.includes('text/html')) {
    return c.html(renderLandingPage());
  }
  return c.json({
    servis: 'Sen CDN',
    status: 'ok'
  });
});

app.get('/assets/fonts/geist/:name', async (c) => {
  const name = c.req.param('name');
  const pixelFontMap: Record<string, string> = {
    'square.woff2': 'GeistPixel-Square.woff2',
    'grid.woff2': 'GeistPixel-Grid.woff2',
    'circle.woff2': 'GeistPixel-Circle.woff2',
    'triangle.woff2': 'GeistPixel-Triangle.woff2',
    'line.woff2': 'GeistPixel-Line.woff2'
  };

  const fontFile = pixelFontMap[name];
  if (!fontFile) {
    return c.json({ greska: 'Фонт није пронађен.' }, 404);
  }

  const filePath = path.join(process.cwd(), 'node_modules', 'geist', 'dist', 'fonts', 'geist-pixel', fontFile);
  const payload = Bun.file(filePath);
  if (!(await payload.exists())) {
    return c.json({ greska: 'Фонт није пронађен.' }, 404);
  }

  return c.newResponse(payload.stream(), 200, {
    'Content-Type': 'font/woff2',
    'Cache-Control': 'public, max-age=31536000, immutable'
  });
});

app.route('/', publicRoutes);
app.route('/private', privateRoutes);
app.route('/admin', adminRoutes);

app.onError((error, c) => {
  console.error(error);
  return c.json({ greska: 'Интерна грешка сервера.' }, 500);
});

await bootstrapDatabase();
await ensureUploadRoot();
await redis.ping();

Bun.serve({
  fetch: app.fetch,
  hostname: config.host,
  port: config.port
});

console.log(`Сен CDN слуша на http://${config.host}:${config.port}`);
