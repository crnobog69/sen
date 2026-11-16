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

### Docker izdanje na Gitcrn-u

U Gitcrn podešavanjima naloga, u **Applications**, napravi token sa dozvolom `write:package`. U **Settings → Actions → Secrets** repozitorijuma ili vlasnika dodaj `REGISTRY_USERNAME` (nalog vlasnika tokena) i `REGISTRY_TOKEN` (vrednost tokena). Nalog mora imati pravo objave paketa za vlasnika slike.

U direktorijumu projekta pokreni `.\docker-build.ps1` na Windowsu ili `bash docker-build.sh` na Linuxu. Skripta snima lokalne izmene i šalje trenutnu granu i tag na Gitcrn. Tag koristi beogradsko vreme u formatu `DD.MM.YYYY_HH-mm-ss`. Runner `linux_amd64` objavljuje isti tag i `latest` za AMD64 i ARM64. Za lokalni build koristi `-Local` ili `--local`.

Gitcrn registry radi preko HTTP-a na internoj mreži. Na Docker mašinama koje se prijavljuju ili povlače sliku, u postojeću listu `insecure-registries` Docker daemon-a dodaj `100.91.132.35:5000` i primeni podešavanje. Za privatne slike prijavi se sa `docker login 100.91.132.35:5000` (za preuzimanje je dovoljan token sa `read:package`).

Compose podrazumevano koristi `100.91.132.35:5000/vltc/sen:latest`. U `.env` možeš postaviti `SEN_IMAGE` na punu putanju sa konkretnim tagom. Za objavljenu sliku pokreni `docker compose pull`, pa `docker compose up -d`.

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
