# Сен CDN API (sen.crnbg.org)

Овај документ је јавна API документација за инстанцу:

- Base URL: `https://sen.crnbg.org`

## Брзи преглед

1. Јавни фајлови: `GET /f/:public_id`
2. Приватни API: `GET|POST|DELETE /private/*` уз `X-API-Key`
3. Админ панел: `GET /admin` (пријава), админ руте су приватне

## Аутентикација

### Приватни API (`/private/*`)

Обавезан header:

```http
X-API-Key: sen_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Без валидног кључа враћа се `401`.

### Админ API (`/admin/*`)

Админ користи cookie сесију (`sen_admin`) након пријаве:

- `POST /admin` (`application/x-www-form-urlencoded`, поље `lozinka`)
- `POST /admin/login` је подржан као компатибилни alias

Пример:

```bash
curl -i -c admin.cookie -X POST https://sen.crnbg.org/admin \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "lozinka=YOUR_ADMIN_PASSWORD"
```

## Root endpoint

### GET `/`

- Browser (`Accept: text/html`) добија landing страницу.
- API клијент (нпр. curl без HTML accept-а) добија JSON статус.

Пример:

```bash
curl -s https://sen.crnbg.org/
```

Пример одговора:

```json
{
  "servis": "Sen CDN",
  "status": "ok"
}
```

## Јавни endpoint

### GET `/f/:public_id`

Враћа фајл само ако је означен као `public=true`.
Опционо заглавље `X-API-Key` омогућава примену лимита и статистике по кључу. Неважећи кључ враћа `401` за јавни фајл.

- `404` ако public ID не постоји или фајл није јаван.
- Успешан одговор враћа stream фајла.
- Ако постоји hash, response садржи `ETag: "sha256-<contentHash>"`.
- Захтев са одговарајућим `If-None-Match` добија `304` без садржаја.
- Одговор без API кључа може да се кешира 60 секунди, после чега се поново проверава. Одговори на захтеве са кључем имају `Cache-Control: private, no-store`.

Пример:

```bash
curl -OJ https://sen.crnbg.org/f/abc123publicid
```

## Приватни endpoint-и (`X-API-Key`)

### GET `/private/files`

Враћа листу додељених фолдера и фајлова за API кључ.  
Сваки file објекат садржи и `contentHash` (SHA-256) када је доступан.

```bash
curl -H "X-API-Key: sen_xxx" https://sen.crnbg.org/private/files
```

### GET `/private/folder/:id`

Враћа фајлове из додељеног фолдера.

- `403` ако фолдер није додељен том API кључу.

```bash
curl -H "X-API-Key: sen_xxx" https://sen.crnbg.org/private/folder/1
```

### GET `/private/file/:id`

Преузимање фајла по интерном ID-у.

- Фајл мора бити експлицитно додељен кључу или кроз додељени фолдер.
- Ако постоји hash, response садржи `ETag: "sha256-<contentHash>"`.

```bash
curl -H "X-API-Key: sen_xxx" -OJ https://sen.crnbg.org/private/file/42
```

### POST `/private/upload/:folder_id`

Upload фајла у додељени фолдер (само ако кључ има `can_upload=true`).

`multipart/form-data`:

- `file` (обавезно)
- `public` (`1` или изостављено)
- `rate_limit_override` (опционо, број)

```bash
curl -H "X-API-Key: sen_xxx" \
  -F "file=@./slika.jpg" \
  -F "public=1" \
  -F "rate_limit_override=120" \
  https://sen.crnbg.org/private/upload/1
```

Могући кодови:

- `201` успешно креирано
- `403` нема upload дозволу или фолдер није додељен
- `409` квота прекорачена

### DELETE `/private/file/:id`

Брисање фајла (само ако кључ има `can_delete=true` и приступ фајлу).

```bash
curl -X DELETE -H "X-API-Key: sen_xxx" \
  https://sen.crnbg.org/private/file/42
```

### GET `/private/quota/:folder_id`

Враћа квоту фолдера:

```json
{
  "folderId": 1,
  "quotaMax": 1073741824,
  "quotaUsed": 145632,
  "quotaFree": 1073596192
}
```

Пример:

```bash
curl -H "X-API-Key: sen_xxx" https://sen.crnbg.org/private/quota/1
```

## Rate limit

Хијерархија лимита:

1. `files.rate_limit_override`
2. `folders.rate_limit_override`
3. `api_keys.rate_limit_override`
4. Глобални лимит (`settings.global_rate_limit`, default 30/min)

Response header-и:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Scope` показује извор лимита (`file`, `folder`, `api` или `global`).

Прекорачење враћа `429` и `Retry-After` са бројем секунди до следећег минутног прозора.
Када Redis није доступан, руте које проверавају лимит враћају `503` са заглављем `Retry-After`.

## Quota

Квота је по фолдеру:

- Upload пролази само ако `quota_used + novi_fajl <= quota_max`
- При брисању се `quota_used` смањује
- Ако нема простора, враћа се `409`

## Безбедносне напомене

- API кључеви се чувају као SHA-256 hash у бази.
- Пун кључ се приказује само једном: при креирању или регенерацији.
- Endpoint-и могу бити видљиви скенирањем; заштита је у аутентикацији, дозволама и rate-limit-у.

## Најчешћи статус кодови

- `200` успешно
- `201` креирано
- `400` неисправан input
- `401` није аутентификован
- `403` нема дозволу
- `404` не постоји
- `409` конфликт (квота/дупликат)
- `429` rate limit
- `500` интерна грешка

## API кључ захтев

За нови API кључ:

- `admin@crnbg.org`
