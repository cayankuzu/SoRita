# SoRita Cloudflare route ve action matrisi

Tarih: 2026-08-30

Kaynak: `infra/cloudflare/sorita-edge/src/contracts.ts`, `src/index.ts`, `src/security.ts` ve
`wrangler.jsonc`

## Release durumu

**Production: NO-GO.** Aşağıdaki tablo depo içindeki uygulanmış sözleşmedir. Cloudflare dashboard,
WAF, DNS, custom route/domain, canlı deploy, Supabase origin HMAC enforcement ve rollback kanıtları
**UNVERIFIED**'dır. Yerel sözleşmenin canlıda çalıştığı bu belgede iddia edilmez.

## Gösterim

- `NS`: `Cache-Control: private, no-store, max-age=0`; ayrıca `Pragma: no-cache`, `Expires: 0`.
- `J3/J2.5`: development/local için 3.000 ms, preview/production için 2.500 ms JWKS timeout.
- `O10/O8`: development/local için 10.000 ms, preview/production için 8.000 ms origin timeout.
- `A30`: `AUTH_RATE_LIMITER`, aynı anahtar için Cloudflare lokasyonu başına 30 çağrı / 60 saniye.
- `P120`: `API_RATE_LIMITER`, aynı anahtar için Cloudflare lokasyonu başına 120 çağrı / 60 saniye.
- `R`: read-like/repeatable çağrı; cevap aynı olmak veya cache'lenmek zorunda değildir.
- `N`: Worker idempotency garantisi vermez; mutation otomatik tekrar edilmez.
- `D`: Worker tekrar etmez; origin repository'sinde account-deletion claim'i idempotent/resumable
  tasarlanmıştır, fakat canlı deploy kanıtı UNVERIFIED'dır.
- `H`: Geçerli bir `Idempotency-Key` varsa yalnız doğrulanıp origin'e aktarılır; Worker anahtarı
  saklamaz, claim etmez ve dedupe yapmaz.
- `E`: Worker edge-origin HMAC başlıklarını üretir. Origin doğrulama/enforcement/replay kanıtı
  **UNVERIFIED** olduğu için bu tek başına direct-origin'i kapatmaz.

JWT gereken satırlarda önce JWKS doğrulaması, sonra rate-limit, sonra origin çağrısı yapılır. Bu
timeout'lar sıralı olabilir; Worker bunların toplamı için ayrıca tek bir global deadline tanımlamaz.
Public action'a bearer token gönderilirse token opsiyonel olarak görmezden gelinmez: tam doğrulanır,
geçersizse `401` döner ve geçerliyse rate-limit kullanıcı anahtarına geçer.

## Tam route/action politikası

| Edge route | Action / discriminator | Method | Auth ve actor bağı | Body üst sınırı | Cache | Timeout | Idempotency | HMAC | Rate-limit |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| `/health` | yok | `GET` | public; config yine valid olmalı | body yok | NS | origin/JWKS yok | idempotent GET | yok | yok |
| `/v1/auth-gateway` | `check-availability`, `excludeUserId` yok | `POST` | public; token verilirse doğrulanır | 32 KiB | NS | O10/O8; token varsa önce J3/J2.5 | H+R | E | A30, anon ise HMAC(IP) |
| `/v1/auth-gateway` | `check-availability`, `excludeUserId` var | `POST` | JWT; `sub === excludeUserId` | 32 KiB | NS | J3/J2.5 + O10/O8 | H+R | E | A30, UID |
| `/v1/auth-gateway` | `login` | `POST` | public; token verilirse doğrulanır | 32 KiB | NS | O10/O8; token varsa önce J3/J2.5 | H+N | E | A30, anon ise HMAC(IP) |
| `/v1/auth-gateway` | `register` | `POST` | public; token verilirse doğrulanır | 32 KiB | NS | O10/O8; token varsa önce J3/J2.5 | H+N | E | A30, anon ise HMAC(IP) |
| `/v1/auth-gateway` | `resend-confirmation` | `POST` | public; token verilirse doğrulanır | 32 KiB | NS | O10/O8; token varsa önce J3/J2.5 | H+N | E | A30, anon ise HMAC(IP) |
| `/v1/auth-gateway` | `request-password-reset` | `POST` | public; token verilirse doğrulanır | 32 KiB | NS | O10/O8; token varsa önce J3/J2.5 | H+N | E | A30, anon ise HMAC(IP) |
| `/v1/auth-gateway` | `prepare-password-reset` (legacy) | `POST` | public; token verilirse doğrulanır | 32 KiB | NS | O10/O8; token varsa önce J3/J2.5 | H+N | E | A30, anon ise HMAC(IP) |
| `/v1/auth-gateway` | `request-password-reset-authenticated` | `POST` | JWT | 32 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | A30, UID |
| `/v1/auth-gateway` | `prepare-password-reset-authenticated` | `POST` | JWT | 32 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | A30, UID |
| `/v1/maps-geocoding` | `search` | `POST` | JWT | 4 KiB | NS | J3/J2.5 + O10/O8 | H+R | E | P120, UID |
| `/v1/maps-geocoding` | `reverse` | `POST` | JWT | 4 KiB | NS | J3/J2.5 + O10/O8 | H+R | E | P120, UID |
| `/v1/moderation-reports` | `targetType=user` | `POST` | JWT; `sub === reporterUserId` | 8 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | P120, UID; action anahtarı `user` |
| `/v1/moderation-reports` | `targetType=list` | `POST` | JWT; `sub === reporterUserId` | 8 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | P120, UID; action anahtarı `list` |
| `/v1/moderation-reports` | `targetType=place` | `POST` | JWT; `sub === reporterUserId` | 8 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | P120, UID; action anahtarı `place` |
| `/v1/moderation-reports` | `targetType=comment` | `POST` | JWT; `sub === reporterUserId` | 8 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | P120, UID; action anahtarı `comment` |
| `/v1/media-assets` | `create-upload-url` | `POST` | JWT | 64 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | P120, UID |
| `/v1/media-assets` | `complete-upload` | `POST` | JWT | 64 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | P120, UID |
| `/v1/media-assets` | `create-read-url` | `POST` | JWT | 64 KiB | NS | J3/J2.5 + O10/O8 | H+R | E | P120, UID |
| `/v1/media-assets` | `create-read-urls` | `POST` | JWT | 64 KiB | NS | J3/J2.5 + O10/O8 | H+R | E | P120, UID |
| `/v1/media-assets` | `delete` | `POST` | JWT | 64 KiB | NS | J3/J2.5 + O10/O8 | H+N | E | P120, UID |
| `/v1/delete-user` | sentetik action `delete-user` | `POST` | JWT | 1 KiB | NS | J3/J2.5 + O10/O8 | H+D | E | P120, UID |

Cloudflare Rate Limiting binding'i per-location ve eventually consistent bir abuse kontrolüdür; kesin
hesap/iş kotası değildir. Binding anahtarı tam olarak aşağıdaki biçimdedir:

```text
user:<verified-uuid-sub>:<edge-route>:<action>
ip:<base64url-hmac-sha256(CF-Connecting-IP, IP_HASH_PEPPER)>:<edge-route>:<action>
```

Anonim public action'da geçerli `CF-Connecting-IP` yoksa `503 client_identity_unavailable` döner.
Binding çağrısı hata verirse `503 rate_limit_unavailable`; limit aşılırsa `429 rate_limited` ve
`Retry-After: 60` döner. Şema/JWT doğrulamasında reddedilen istekler binding'e ulaşmaz; bu erken
trafik WAF/body/method kurallarıyla ayrıca korunmalıdır ve canlı WAF durumu UNVERIFIED'dır.

## Exact payload şemaları

Bütün objeler strict'tir: listelenmeyen alanlar reddedilir. Bütün string sınırları normalize edilmiş
değer üzerinde uygulanır. Sayılar JSON number olmalıdır.

### `auth-gateway`

| Action | Zorunlu alanlar | Opsiyonel alanlar ve sınırlar |
| --- | --- | --- |
| `check-availability` | `email` veya `username` alanlarından en az biri | `email` valid ve en çok 254; `username` `^[a-z0-9_]{3,30}$`; `excludeUserId` UUID |
| `login` | `email`, `password` | email en çok 254; password 1–128 |
| `register` | `email`, `name`, `password`, `username`, `redirectUrl`, strict `legalConsent` | `name` 2–60; password 8–128 ve lower/upper/rakam/sembol; `bio` en çok 150; `profilePhoto`/`coverPhoto` valid URL en çok 500; `interests` en çok 20 öğe, her biri 1–40; `redirectUrl` URL en çok 400; consent `acceptedAt` datetime, `version` 1–32, `documentsAccepted` 1–10 öğe ve her biri 1–32 |
| `resend-confirmation` | `email`, `redirectUrl` | email en çok 254; URL en çok 400 |
| `request-password-reset` | `email`, `redirectUrl` | email en çok 254; URL en çok 400 |
| `prepare-password-reset` | `email` | email en çok 254 |
| `request-password-reset-authenticated` | `currentPassword`, `redirectUrl` | password 1–128; URL en çok 400 |
| `prepare-password-reset-authenticated` | `currentPassword` | password 1–128 |

Email ve username trim edilip lowercase'e çevrilir. Worker validate edilen veriyi yeniden serialize
etmez; HMAC ve origin isteği, byte sınırı içinde okunan exact özgün JSON metnini kullanır.

### `maps-geocoding`

| Action | Exact alanlar |
| --- | --- |
| `search` | `action`, trim sonrası 1–120 karakter `query` |
| `reverse` | `action`, `latitude` -90..90, `longitude` -180..180 |

### `moderation-reports`

Ortak alanlar: `reporterUserId` 1–120, `reason` 1–160, opsiyonel `details` en çok 2.000.
`reporterUserId` JWT `sub` ile birebir eşleşmelidir.

| `targetType` | Ek zorunlu alan |
| --- | --- |
| `user` | `targetUserId` 1–120 |
| `list` | `listId` 1–120 |
| `place` | `placeId` 1–120 |
| `comment` | `commentId` 1–120 |

### `media-assets`

İzinli content type'lar: `image/heic`, `image/jpeg`, `image/png`, `image/webp`, `video/3gpp`,
`video/mp4`, `video/quicktime`, `video/webm`, `video/x-m4v`.

| Action | Exact alanlar ve sınırlar |
| --- | --- |
| `create-upload-url` | `bucket=place-media-private`; `contentType`; `fileSizeBytes` integer 1..140.313.800; `prefix` 1–160; opsiyonel `extension` 1–8 |
| `complete-upload` | `bucket=place-media-private`; `contentType`; `fileSizeBytes` integer 1..140.313.800; `mediaType=photo\|video`; `objectPath` 1–512; opsiyonel `durationSeconds` 0..183, `width`/`height` integer 1..8192 |
| `create-read-url` | `bucket=place-media-private`; `path` 1–512 |
| `create-read-urls` | `bucket=place-media-private`; 1–64 adet, her biri 1–512 `paths` |
| `delete` | `bucket=profile-media\|place-media\|place-media-private`; 0–64 adet, her biri 1–512 `paths` |

`action=upload` ve objenin üst seviyesinde `fileBase64` bulunan her payload `413
media_body_proxy_forbidden` ile reddedilir. Dosya içeriği Worker'a gönderilemez.

### `delete-user`

Gövde exact boş obje `{}` olmalıdır. Ek alan kabul edilmez.

## Global HTTP sözleşmesi

- Yalnız `/health` için `GET`; beş proxy yolu için `POST`; exact browser preflight için `OPTIONS`.
- Query string bulunan her istek `400`; bilinmeyen veya trailing-slash yol `404`; yanlış yöntem `405`
  ve uygun `Allow` başlığı.
- Proxy gövdesi yalnız `application/json` veya `application/json; charset=utf-8`; content encoding yok
  ya da `identity`. Geçersiz/boş JSON `400`, fazla gövde `413`, yanlış media/encoding `415`.
- Browser `Origin` exact allowlist'te olmalıdır. Native istek `Origin` olmadan kabul edilir. Preflight
  yalnız beklenen method ve allowlist header'larıyla geçer.
- İstemciden gelen `Idempotency-Key` yalnız görünür ASCII (`0x21..0x7e`) ve 1–200 karakterse aktarılır.
  `X-Device-Id`, `X-Nonce`, `X-Signature`, `X-Timestamp` da kendi dar regex'leriyle doğrulanarak
  aktarılır. İstemcinin `X-Request-Id` değeri origin'e taşınmaz; Worker kendi UUID'sini üretir.
- Origin çağrısı tam bir kez yapılır, redirect takip edilmez ve otomatik retry/fallback yoktur.
- Origin `429` cevabının gövdesi sanitize edilir; geçerli `Retry-After` korunur, yoksa 60 kullanılır.
  Origin redirect veya `5xx` -> sanitize `502`; timeout -> `504`; non-JSON -> `502`.
- `2xx` ve `4xx` JSON origin gövdesi stream edilir, fakat origin cache/cookie başlıkları aktarılmaz ve
  güvenli Worker response başlıkları yeniden oluşturulur.

## Origin HMAC sözleşmesi

Her proxied POST'ta Worker şu başlıkları üretir:

```text
X-Sorita-Edge-Timestamp: <Unix milliseconds>
X-Sorita-Edge-Nonce: <crypto.randomUUID()>
X-Sorita-Edge-Body-Sha256: <lowercase SHA-256 hex of exact forwarded body>
X-Sorita-Edge-Signature: v1=<base64url HMAC-SHA256>
```

İmzalanan mesaj exact beş newline-delimited alandır:

```text
<timestamp>
<nonce>
POST
/functions/v1/<function-name>
<body-sha256-hex>
```

Origin aynı metni kurmalı, signature'ı sabit zamanda karşılaştırmalı, kısa timestamp penceresi
uygulamalı ve nonce'ı Postgres'te atomik/biricik claim etmelidir. HMAC, idempotency anahtarı değildir;
her gateway denemesinde yeni nonce üretir. Origin enforcement doğrulanana kadar direct-origin bypass
riskinin kapandığı kabul edilmez.

## Kanıt sınırı

Yerel Worker suite'i exact method/path/body/schema/action, JWT, CORS, rate deny/failure, no-store,
HMAC, timeout, 429, 5xx, response isolation ve health secrecy davranışlarını test eder. Cloudflare
dashboard/WAF/DNS/deploy/rollback ile canlı Supabase origin enforcement bu test kapsamının dışındadır,
**UNVERIFIED** ve production için **NO-GO**'dur.

## Birincil kaynaklar

- [Cloudflare Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Supabase JWT signing keys ve JWKS](https://supabase.com/docs/guides/auth/signing-keys)
