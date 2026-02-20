# Sen CDN

Self-hosted CDN за Raspberry Pi (Bun + Hono + Drizzle/libSQL + Redis + HTMX).

## Stack

- Bun + Hono
- Drizzle ORM + libSQL/Turso
- Redis (rate limit)
- HTMX + Lucide
- Docker Compose (`sen-app`, `redis`, `caddy`)

## Брз почетак

1. Копирај env:

```bash
cp .env.example .env
```

Или аутоматски генериши `.env`:

```bash
bun run env:init
```

2. Подеси бар ово у `.env`:

- `ADMIN_PASSWORD`
- `ADMIN_COOKIE_SECRET`
- `CADDY_DOMAIN`
- `ACME_EMAIL`

3. Покрени:

```bash
docker compose pull
docker compose up -d
```

4. Отвори:

- `https://<CADDY_DOMAIN>/admin`
- или локално: `https://localhost/admin`
- или директно апликацију: `http://localhost:9995`

## Локални развој без Docker-а

```bash
bun install
bun run dev
```

Подразумевани URL је `http://0.0.0.0:9995`.

## Buildx + Registry (RPi5 deploy)

Ако на RPi5 желиш да само повлачи слику из локалног registry-ја:

1. На build машини направи и push-уј ARM64 image:

```bash
docker buildx build --platform linux/arm64 -t 100.91.132.35:5050/sen:0.1.0 --push .
```

2. На RPi5 у `.env` постави:

```env
SEN_IMAGE=100.91.132.35:5050/sen:0.1.0
```

3. На RPi5 повуци и подигни сервисе:

```bash
docker compose pull
docker compose up -d
```

## Руте

### Јавна
- `GET /f/:public_id`

### Приватна (`X-API-Key`)
- `GET /private/files`
- `GET /private/folder/:id`
- `GET /private/file/:id`
- `POST /private/upload/:folder_id`
- `DELETE /private/file/:id`
- `GET /private/quota/:folder_id`

### Admin
- `GET /admin`
- `GET /admin/dash`
- `POST /admin/upload`
- `DELETE /admin/file/:id`
- `PATCH /admin/file/:id`
- `POST /admin/folder`
- `PATCH /admin/folder/:id`
- `DELETE /admin/folder/:id`
- `POST /admin/apikey`
- `DELETE /admin/apikey/:id`
- `POST /admin/apikey/:id/revoke`
- `PATCH /admin/apikey/:id`
- `POST /admin/apikey/:id/folder/:fid`
- `DELETE /admin/apikey/:id/folder/:fid`
- `POST /admin/apikey/:id/file/:fid`
- `DELETE /admin/apikey/:id/file/:fid`
- `PATCH /admin/settings`

## Напомене

- Фајлови се чувају само на фајл систему (`UPLOAD_ROOT`).
- Метаподаци иду у libSQL/Turso.
- Rate limit приоритет: file > folder > api key > global.
- Квота се води по фолдеру (`quota_used` се ажурира на upload/delete).
- Redis је меморијски ограничен преко `REDIS_MAXMEMORY` (default `192mb`) + `allkeys-lru` eviction, да не расте бесконачно на RPi.
