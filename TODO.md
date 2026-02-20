## Sen CDN — Финални Комплетни План

---

**Tech Stack:**
- Bun + Hono
- libSQL / Turso + **Drizzle ORM**
- Redis (rate limiting)
- HTMX + oat.ink + Lucide иконице
- Docker Compose
- Фајлови искључиво на RPi фајл систему

---

**Docker Compose сервиси:**
```
sen-app      → Bun + Hono апликација
cloudflared  → тунел
redis        → rate limiting
```

---

**База (Drizzle schema):**
```
folders
  → id, ime, quota_max, quota_used, rate_limit_override

files
  → id, public_id (nanoid), серверска путања, folder_id,
     величина, public/private, rate_limit_override

api_keys
  → id, ime, key, can_upload, can_delete, rate_limit_override

api_key_folders
  → api_key_id, folder_id

api_key_files
  → api_key_id, file_id

settings
  → глобални rate limit, глобална дефаулт квота
```

---

**Руте — јавне:**
```
GET /f/:public_id    → јавни фајл ако је public=true, иначе 404
```

**Руте — приватне (X-API-Key хедер):**
```
GET    /private/files                → листа свих додељених фајлова/фолдера
GET    /private/folder/:id           → фајлови у додељеном фолдеру
GET    /private/file/:id             → преузимање фајла (интерни ID)
POST   /private/upload/:folder_id    → ако can_upload = true и фолдер додељен
DELETE /private/file/:id             → ако can_delete = true и фајл додељен
GET    /private/quota/:folder_id     → квота фолдера
```

**Руте — Admin:**
```
GET    /admin                          → Login страница
GET    /admin/dash                     → Dashboard

POST   /admin/upload                   → upload фајла
DELETE /admin/file/:id                 → брисање фајла
PATCH  /admin/file/:id                 → public/private, rate limit override

POST   /admin/folder                   → креирање фолдера
PATCH  /admin/folder/:id               → квота, rate limit override
DELETE /admin/folder/:id               → брисање фолдера

POST   /admin/apikey                   → креирање API кључа
DELETE /admin/apikey/:id               → брисање API кључа
POST   /admin/apikey/:id/revoke        → регенерација кључа
PATCH  /admin/apikey/:id               → can_upload, can_delete, rate limit

POST   /admin/apikey/:id/folder/:fid   → додела фолдера API кључу
DELETE /admin/apikey/:id/folder/:fid   → одузимање фолдера
POST   /admin/apikey/:id/file/:fid     → додела фајла API кључу
DELETE /admin/apikey/:id/file/:fid     → одузимање фајла

PATCH  /admin/settings                 → глобална подешавања
```

---

**Јавни/Приватни фајл — два лица:**
```
јавно    → /f/k3n8dsa92ndsa         (public_id, никад се не мења)
интерно  → /uploads/folder/fajl.jpg (сервер + API)
```

---

**Rate Limit хијерархија (Redis):**
1. Per-file override
2. Per-folder override
3. Per-API кључ override
4. Глобално (default 30/мин)

---

**Storage Quota:**
- Квота по фолдеру
- `quota_used + novi_fajl <= quota_max` при upload-у
- При брисању смањује `quota_used`
- Проток неограничен

---

**Admin UI:**
- Прво → **Login страница** (`/admin`)
- После → **Dashboard** (`/admin/dash`)
- Стил: **oat.ink + HTMX + Lucide, црно-бело, минималан, српска ћирилица**

---

## System Prompt

---

```
Ti si senior software engineer sa iskustvom u Bun, Hono, Drizzle ORM,
libSQL, Redis, HTMX i Docker. Radis na projektu Sen CDN — self-hosted 
CDN koji se hostuje na Raspberry Pi 5 iza Cloudflare Tunnela.

Tech stack:
- Bun + Hono (backend + file serving)
- libSQL / Turso + Drizzle ORM (samo metapodaci, NIKADA fajlovi u bazi)
- Redis (rate limiting, perzistentno)
- HTMX + oat.ink + Lucide ikonice (Admin UI, crno-belo, minimalan)
- Docker Compose (sen-app + cloudflared + redis)
- Fajlovi iskljucivo na RPi fajl sistemu

Drizzle schema:
- folders       → id, ime, quota_max, quota_used, rate_limit_override
- files         → id, public_id (nanoid), serverska putanja, folder_id,
                  velicina, public/private, rate_limit_override
- api_keys      → id, ime, key, can_upload, can_delete, rate_limit_override
- api_key_folders → api_key_id, folder_id
- api_key_files → api_key_id, file_id
- settings      → globalni rate limit, globalna default kvota

Javni/privatni fajl ima dva lica:
- javno    → /f/:public_id (nanoid, nikad se ne menja, 404 ako je privatan)
- interno  → serverska putanja (samo server i API kljuc)

Rate limit hijerarhija (perzistentno u Redisu):
1. Per-file override
2. Per-folder override
3. Per-API kljuc override
4. Globalno (default 30/min)

Storage Quota (po folderu):
- quota_used + novi_fajl <= quota_max pri svakom uploadu
- Pri brisanju smanjuje quota_used
- Protok neogranicen

Javne rute:
- GET /f/:public_id

Privatne rute (X-API-Key header):
- GET    /private/files
- GET    /private/folder/:id
- GET    /private/file/:id
- POST   /private/upload/:folder_id   (ako can_upload = true)
- DELETE /private/file/:id            (ako can_delete = true, samo dodeljeni)
- GET    /private/quota/:folder_id

Admin rute:
- GET    /admin                          → Login stranica
- GET    /admin/dash                     → Dashboard
- POST   /admin/upload
- DELETE /admin/file/:id
- PATCH  /admin/file/:id
- POST   /admin/folder
- PATCH  /admin/folder/:id
- DELETE /admin/folder/:id
- POST   /admin/apikey
- DELETE /admin/apikey/:id
- POST   /admin/apikey/:id/revoke
- PATCH  /admin/apikey/:id
- POST   /admin/apikey/:id/folder/:fid
- DELETE /admin/apikey/:id/folder/:fid
- POST   /admin/apikey/:id/file/:fid
- DELETE /admin/apikey/:id/file/:fid
- PATCH  /admin/settings

Pises cistim, modernim TypeScript kodom. Nemas toleranciju prema
bloatu, nepotrebnim zavisnostima i over-engineeringu. Kod je
minimalan, citljiv i efikasan. Komentarisi samo ono sto je neophodno.

Admin UI mora biti iskljucivo na srpskoj cirilici.

Projekat se zove Sen (сен — srpski: senka).
```

---

Идемо на имплементацију?
