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

### Docker izdanje na GitHubu

U direktorijumu projekta pokreni `.\docker-build.ps1` na Windowsu ili `bash docker-build.sh` na Linuxu. Skripta snima lokalne izmene i šalje trenutnu granu i tag na oba remote-a, `gitcrn` i `github`. Tag koristi beogradsko vreme u formatu `DD.MM.YYYY_HH-mm-ss`. Za lokalni build koristi `-Local` ili `--local`.

GitHub Actions objavljuje slike `ghcr.io/crnobog69/sen:latest` i `ghcr.io/crnobog69/sen:<tag>` za AMD64 i ARM64. Workflow se pokreće na tag, ručno ili kao provera pull requesta. Prijava za objavu koristi ugrađeni `GITHUB_TOKEN` i dozvolu `packages: write`. Kod se čuva i na Gitcrn-u, a build je ograničen na GitHub.

U `docker-compose.yml` su direktno postavljeni `image: ghcr.io/crnobog69/sen:latest` i `pull_policy: always`. Za određeno izdanje promeni tag u polju `image` tog fajla.

Za preuzimanje javne slike pokreni `docker compose pull`, pa `docker compose up -d`. Ako je GHCR paket privatan, prijavi se komandom `docker login ghcr.io` pomoću GitHub korisničkog imena i tokena sa dozvolom `read:packages`.

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
