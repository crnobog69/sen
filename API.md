# Sen CDN API

Ovaj dokument opisuje kako se koristi Sen API.

## Base URL

- Lokalno (default): `http://localhost:9995`
- Health check: `GET /`

Primer:

```bash
curl -s http://localhost:9995/
```

Odgovor:

```json
{
  "servis": "Sen CDN",
  "status": "ok"
}
```

## Autentikacija

Sen ima 3 nivoa pristupa:

1. Javni (`/f/:public_id`) - opcioni `X-API-Key` za limit i statistiku po ključu.
2. Privatni (`/private/*`) - potreban `X-API-Key` header.
3. Admin (`/admin/*`) - potrebna prijava i cookie sesija (`sen_admin`).

### Privatni API key

```bash
curl -H "X-API-Key: sen_xxx" http://localhost:9995/private/files
```

Ako header ne postoji ili kljuc nije validan, vraca se `401`.

### Admin login (cookie session)

```bash
curl -i -c admin.cookie -X POST http://localhost:9995/admin \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "lozinka=promeni_me"
```

Zasticene admin rute se dalje pozivaju sa `-b admin.cookie`.

## Format odgovora

- Greske: `{"greska": "..."}`
- Akcije (admin/private): uglavnom `{"poruka": "..."}`
- Stream rute (`/f/:public_id`, `/private/file/:id`, `/admin/file/:id/raw`) vracaju sadrzaj fajla.
- Za admin akcione rute (`POST/PATCH/DELETE /admin/...`): ako posaljes `HX-Request: true`, odgovor je HTML fragment za dashboard; bez tog header-a vraca JSON.

## Rate limit

Rate limit se primenjuje hijerarhijski:

1. `files.rate_limit_override`
2. `folders.rate_limit_override`
3. `api_keys.rate_limit_override`
4. globalni limit (`settings.global_rate_limit`, default 30/min)

Response header-i:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Scope` ima vrednost `file`, `folder`, `api` ili `global`.

Kad se predje limit: `429` + `{"greska":"Прекорачен лимит захтева."}`.
Zaglavlje `Retry-After` daje broj sekundi do sledećeg minutnog prozora.

Ako je limit postavljen na `0`, takodje `429`.

## Quota (storage)

Quota je po folderu:

- Upload prolazi samo ako `quotaUsed + novi_fajl <= quotaMax`
- Pri brisanju fajla `quotaUsed` se smanjuje
- Ako je kvota prekoracena: `409`

## Javni endpointi

## GET `/f/:public_id`

Vraca javni fajl (`public=true`). Ako fajl nije javan ili ne postoji, vraca `404`.
Sa validnim `X-API-Key` primenjuje se isti prioritet limita kao i kod privatnih ruta.
Ako je zaglavlje poslato sa nevažećim ključem, zahtev za javni fajl vraća `401`.
Ako fajl ima izracunat hash, odgovor sadrzi `ETag: "sha256-<contentHash>"`.

Primer:

```bash
curl -OJ http://localhost:9995/f/k3n8dsa92ndsa
```

## Privatni endpointi (`X-API-Key` obavezan)

## GET `/private/files`

Lista svih fajlova/foldera dostupnih datom API kljucu.
File objekti ukljucuju i `contentHash` (SHA-256) kada je dostupan.

```bash
curl -H "X-API-Key: sen_xxx" http://localhost:9995/private/files
```

## GET `/private/folder/:id`

Lista fajlova iz dodeljenog foldera.

- `403` ako folder nije dodeljen API kljucu.

```bash
curl -H "X-API-Key: sen_xxx" http://localhost:9995/private/folder/1
```

## GET `/private/file/:id`

Preuzimanje fajla po internom ID-u (samo ako je fajl dodeljen direktno ili kroz folder).
Ako fajl ima izracunat hash, odgovor sadrzi `ETag: "sha256-<contentHash>"`.

```bash
curl -H "X-API-Key: sen_xxx" -OJ http://localhost:9995/private/file/10
```

## POST `/private/upload/:folder_id`

Upload u folder ako API key ima `can_upload=true` i folder je dodeljen.

`multipart/form-data` polja:

- `file` (obavezno)
- `public` (`1` ili izostavljeno)
- `rate_limit_override` (opciono, broj)

```bash
curl -H "X-API-Key: sen_xxx" \
  -F "file=@./slika.jpg" \
  -F "public=1" \
  -F "rate_limit_override=120" \
  http://localhost:9995/private/upload/1
```

## DELETE `/private/file/:id`

Brisanje fajla ako API key ima `can_delete=true` i fajl je dodeljen.

```bash
curl -X DELETE -H "X-API-Key: sen_xxx" http://localhost:9995/private/file/10
```

## GET `/private/quota/:folder_id`

Vraca zauzece i slobodan prostor za dodeljeni folder.

```bash
curl -H "X-API-Key: sen_xxx" http://localhost:9995/private/quota/1
```

Primer odgovora:

```json
{
  "folderId": 1,
  "quotaMax": 1073741824,
  "quotaUsed": 145632,
  "quotaFree": 1073596192
}
```

## Admin endpointi

Napomena: Admin API koristi cookie sesiju (`sen_admin`).

### HTML rute

- `GET /admin` - login stranica
- `GET /admin/dash` - dashboard
- `GET /admin/dash/content` - dashboard content (HTMX refresh)

### Login / logout

- `POST /admin` (`application/x-www-form-urlencoded`, polje `lozinka`)
- `POST /admin/login` (kompatibilni alias)
- `POST /admin/logout`

### Fajlovi

## GET `/admin/file/:id/raw`

Raw preview/download internog fajla za admin sesiju.

## POST `/admin/upload`

Admin upload (`multipart/form-data`):

- `folder_id` (obavezno)
- `file` (obavezno)
- `public` (`1` ili izostavljeno)
- `rate_limit_override` (opciono)

## PATCH `/admin/file/:id`

Body (`application/x-www-form-urlencoded` ili `multipart`):

- `public` (`0`/`1`)
- `rate_limit_override` (broj ili prazno)

## DELETE `/admin/file/:id`

Brise fajl i azurira `quotaUsed` foldera.

### Folderi

## POST `/admin/folder`

Polja:

- `ime` (obavezno)
- `quota_max_gb` (opciono, preporuceno)
- `quota_max` (opciono, bajtovi)
- `rate_limit_override` (opciono)

Ako kvota nije prosledjena, koristi se globalni default.

## PATCH `/admin/folder/:id`

Polja:

- `quota_max_gb` ili `quota_max`
- `rate_limit_override`

Nova kvota ne sme biti manja od trenutnog `quotaUsed` (`409`).

## DELETE `/admin/folder/:id`

Brisanje foldera je dozvoljeno samo ako je folder prazan.

### API kljucevi

## POST `/admin/apikey`

Polja:

- `ime` (obavezno)
- `can_upload` (`0`/`1`)
- `can_delete` (`0`/`1`)
- `rate_limit_override` (opciono)

Uspeh (`201`) vraca i novi key:

```json
{
  "poruka": "...",
  "key": "sen_..."
}
```

Napomena: API kljucevi se u bazi cuvaju kao SHA-256 hash. Puni kljuc se prikazuje samo jednom, pri kreiranju ili regeneraciji.

## PATCH `/admin/apikey/:id`

Prihvata formu ili JSON. Izostavljena polja zadržavaju postojeće vrednosti.

- `can_upload`
- `can_delete`
- `rate_limit_override` kao nenegativan ceo broj. Prazna vrednost u formi ili `null` u JSON-u uklanja override. Vrednost `0` blokira zahteve na koje se primenjuje.

## POST `/admin/apikey/:id/revoke`

Regenerise key, odgovor sadrzi novi `key`.

## DELETE `/admin/apikey/:id`

Brise API kljuc.

### Dodele (folder/file -> API key)

- `POST /admin/apikey/:id/folder/:fid`
- `DELETE /admin/apikey/:id/folder/:fid`
- `POST /admin/apikey/:id/file/:fid`
- `DELETE /admin/apikey/:id/file/:fid`

### Global settings

## PATCH `/admin/settings`

Polja:

- `global_rate_limit` (broj > 0)
- `global_default_quota_gb` (opciono)
- `global_default_quota` (opciono, bajtovi)

## Brz admin workflow (curl)

1. Login i sacuvaj cookie:

```bash
curl -i -c admin.cookie -X POST http://localhost:9995/admin \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "lozinka=promeni_me"
```

2. Kreiraj folder:

```bash
curl -b admin.cookie -X POST http://localhost:9995/admin/folder \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "ime=anime&quota_max_gb=15&rate_limit_override=60"
```

3. Upload fajla u folder `1`:

```bash
curl -b admin.cookie -X POST http://localhost:9995/admin/upload \
  -F "folder_id=1" \
  -F "file=@./video.webm" \
  -F "public=1"
```

4. Kreiraj API key:

```bash
curl -b admin.cookie -X POST http://localhost:9995/admin/apikey \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "ime=bot&can_upload=1&can_delete=1"
```

5. Dodeli folder API key-u (`id=1`, `folder=1`):

```bash
curl -b admin.cookie -X POST http://localhost:9995/admin/apikey/1/folder/1
```

6. Koristi private API sa dobijenim kljucem:

```bash
curl -H "X-API-Key: sen_xxx" http://localhost:9995/private/files
```

## Najcesci status kodovi

- `200` - uspesno
- `201` - kreirano
- `400` - neispravan input
- `401` - nije autentifikovan
- `403` - nema dozvolu/pristup
- `404` - resurs ne postoji
- `409` - konflikt (kvota, duplikat, neprazan folder)
- `429` - rate limit
- `500` - interna greska
