# SoRita API sözleşmeleri

Uygulamanın sunucuyla konuştuğu iki yol: altı edge function ve Supabase
RPC'leri. Bu belge, istemcinin gönderdiği ve beklediği şekli tek yerde
toplar. Kaynak her zaman koddur; alanlar handler'lardaki zod şemalarından ve
uygulamadaki çağrı yerlerinden alındı (2026-09-25, `main`).

Sözleşmeyi koruyanlar:

- `rpc-contract:check`: uygulamanın çağırdığı her RPC bir migration'da
  tanımlı mı.
- `supabase/functions/*/handler.test.ts`: her function'ın doğrulama, yetki,
  hız sınırı ve hata yolları (`security:verify` içinde).
- `src/mobile/app/data/mappers/__tests__/placeFeedCardMapper.test.ts`:
  sunucu yeni alan, null ya da metin olarak sayı gönderdiğinde istemci
  çökmez.

## Ortak kurallar (tüm edge function'lar)

**İstek.** Yalnız `POST` (ön kontrol için `OPTIONS`). Gövde JSON. Kimlik
isteyen function'lar `Authorization: Bearer <access token>` bekler.

**İmzalı istek.** `x-device-id` (8–128 karakter, `[a-zA-Z0-9_-]`),
`x-nonce`, `x-timestamp` (ms) ve `x-signature` başlıkları zorunlu. İmza,
`METHOD:functionName:deviceId:timestamp:nonce:sha256(body)` metninin
HMAC'i. İmza tutmazsa ya da zaman damgası pencere dışındaysa `401`; aynı
nonce ikinci kez gelirse `409` (tekrar oynatma koruması).

**Yanıt.** Her yanıt JSON; CORS izin listesi, `Strict-Transport-Security`,
`Content-Security-Policy: default-src 'none'`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff` ve `X-Request-Id` başlıklarıyla gelir.

**Hata gövdesi.** `{ "code": "<makine kodu>", "error": "<kullanıcıya
gösterilebilir Türkçe metin>" }`. İstemci `code`'a göre karar verir, `error`
metnini gösterir.

**Ortak hata kodları.**

| Kod | HTTP | Anlamı |
|---|---|---|
| `method_not_allowed` | 405 | POST dışı istek |
| `missing_authorization` | 401 | Bearer başlığı yok |
| `invalid_jwt` / `invalid_session` / `invalid_token` | 401 | Oturum geçersiz ya da süresi dolmuş |
| `invalid_signature` / `invalid_device` | 401 | İmza başlıkları eksik, bozuk ya da süresi geçmiş |
| `invalid_input` / `invalid_request_body` / `invalid_request` | 400 | Gövde şemaya uymuyor |
| `rate_limited` | 429 | Sınır aşıldı; `Retry-After` ve `X-RateLimit-*` başlıkları gelir |
| `misconfigured` | 503 | Sunucu ayarı eksik (anahtar, gizli değer) |
| `unexpected` / `internal_error` | 500 | Beklenmeyen hata; ayrıntı yalnız sunucu logunda |

## Edge function'lar

### `auth-gateway`

Kimlik gerekmez (son ikisi hariç). Eylem `action` alanıyla seçilir.

| `action` | Alanlar | Başarılı yanıt |
|---|---|---|
| `check-availability` | `email?` ya da `username?` (en az biri), `excludeUserId?` (uuid) | `{ emailAvailable, usernameAvailable }` |
| `login` | `email`, `password` | `{ session: { accessToken, refreshToken } }` |
| `register` | `email`, `password` (8–128, büyük/küçük harf, rakam, sembol), `name` (2–60), `username` (`[a-z0-9_]{3,30}`), `bio?` (≤150), `interests?` (≤20 × ≤40), `profilePhoto?`, `coverPhoto?` (URL ≤500), `legalConsent`, `redirectUrl` | `{ success: true }` |
| `resend-confirmation` | `email`, `redirectUrl` | `{ success: true }` |
| `request-password-reset` | `email`, `redirectUrl` | `{ success: true }` |
| `prepare-password-reset` | `email` | `{ success: true }` |
| `request-password-reset-authenticated` | `currentPassword`, `redirectUrl` (Bearer gerekir) | `{ success: true }` |
| `prepare-password-reset-authenticated` | `currentPassword` (Bearer gerekir) | `{ success: true }` |

Hız sınırı: her eylem istemci (cihaz ya da IP) başına dakikada 10. `login` ayrıca 15 dakikada 5
(genel) ve e-posta başına 15 dakikada 5; parola sıfırlama (oturumlu) 15
dakikada 5. Özel kodlar: `invalid_credentials`, `account_locked`,
`duplicate_username`, `invalid_redirect`, `invalid_origin`,
`invalid_origin_signature`.

### `maps-geocoding`

Bearer gerekir.

| `action` | Alanlar | Başarılı yanıt |
|---|---|---|
| `search` | `query` (1–120), `near?` (`{ latitude, longitude }`; sonuçlar bu noktanın 50 km çevresine önce gelir, bölge TR) | `{ results: [{ placeId, name, address, lat, lng }] }`, en fazla 20 |
| `reverse` | `latitude` (−90…90), `longitude` (−180…180) | `{ result: { name?, address?, lat, lng, isPointOfInterest } }` |

Hız sınırı: eylem başına kullanıcı için dakikada 20. Google'a istek 8 sn'de
zaman aşımına uğrar.

### `media-assets`

Bearer gerekir. Medya baytı yalnız profil görselinin doğrudan yüklemesinde
function'dan geçer; yer medyası imzalı adresle doğrudan depoya gider.

| `action` | Alanlar | Başarılı yanıt |
|---|---|---|
| `upload` | `bucket` (doğrudan yükleme kovaları), `contentType` (görsel türleri), `fileBase64`, `prefix` (≤160), `extension?` (≤8) | `{ publicUrl }` |
| `create-upload-url` | `bucket`, `contentType`, `fileSizeBytes`, `prefix`, `uploadSessionId` (uuid), `extension?` | `{ objectPath, signedUrl, uploadSessionId }` |
| `complete-upload` | `bucket`, `contentType`, `fileSizeBytes`, `mediaType` (`photo`/`video`), `objectPath`, `uploadSessionId`, `width?`/`height?` (≤8192), `durationSeconds?` | `{ objectPath, uploadSessionId, verified: true }` ve açık kovada `publicUrl`, özel kovada `storageUri` |
| `create-read-url` | `bucket: place-media-private`, `path` (≤512) | `{ signedUrl, expiresInSeconds }` |
| `create-read-urls` | `bucket: place-media-private`, `paths` (1–64) | `{ items: [{ path, signedUrl }], expiresInSeconds }` |
| `delete` | `bucket`, `paths` (≤64), `uploadSessionId?` | `{ success: true }` |

Hız sınırı (kullanıcı başına, dakikada): silme 160, yükleme adresi ve
tamamlama 72 (6 medya × dosya ve küçük görsel × 3 liste), okuma adresi 600,
profil görseli 120. Özel kodlar: `file_too_large`, `unsupported_media_type`,
`upload_init_failed`, `upload_failed`, `read_url_failed`, `delete_failed`.

### `moderation-reports`

Bearer gerekir; `reporterUserId` oturumdaki kullanıcıyla aynı olmalı.

| `targetType` | Alanlar |
|---|---|
| `user` | `targetUserId` |
| `list` | `listId` |
| `place` | `placeId` |
| `comment` | `commentId` |

Hepsinde `reason` (1–160), `details?` (≤2000), `reporterUserId`. Başarılı
yanıt `{ success: true }`. Hız sınırı: kullanıcı başına 10 dakikada 12. Özel kodlar:
`reporter_mismatch`, `duplicate_report`.

### `personal-data`

Bearer gerekir. Gövde tam olarak `{ "action": "export" }`. Yanıt kullanıcının
verisinin sınırlı bir dökümü; toplam en fazla 5 MB, sınırı aşan koleksiyonlar
`truncated` ile işaretlenir. Hız sınırı: 24 saatte 2. Özel kodlar:
`export_unavailable`, `export_too_large`, `request_too_large`,
`security_unavailable`.

### `delete-user`

Bearer gerekir; gövde `{}`. Hesap silme işini başlatır ya da süren işi
kaldığı yerden devam ettirir. Başarılı yanıt `{ success: true }`. Hız
sınırı: saatte 2. Özel kod: `deletion_in_progress` (409). Geri alınamaz;
yalnız test hesaplarında denenir (Faz 11).

### `admin-broadcast-notification`

Uygulamadan çağrılmaz; operasyon aracı. `x-admin-token` ister.

## RPC'ler

Uygulamanın çağırdığı RPC'ler (`supabase.rpc`). Sayfalı olanlar imleçle
ilerler: bir önceki sayfanın son satırının zamanı ve kimliği.

| RPC | Parametreler | Çağıran |
|---|---|---|
| `feed_page_complete` | `p_limit`, `p_cursor_published_at`, `p_cursor_id` | `homeFeedRepository` |
| `explore_page_complete` | `p_kind`, `p_query`, `p_limit`, `p_cursor_rank`, `p_cursor_id` | `exploreRepository` |
| `profile_summary` | `p_user_id` | `profileRepository` |
| `profile_content_page_complete` | `p_user_id`, `p_tab`, `p_limit`, `p_cursor`, `p_cursor_id` | `profileRepository` |
| `list_detail_header` | `p_list_id` | `listDetailRepository` |
| `list_places_page` | `p_list_id`, `p_limit`, `p_cursor_added_at`, `p_cursor_id` | `listDetailRepository` |
| `location_place_cards_page` | `p_owner_id`, `p_place_name`, `p_lat`, `p_lng`, `p_limit`, `p_cursor_updated_at`, `p_cursor_id` | `locationPlaceCardsRepository` |
| `place_comment_threads_page` | `p_list_place_id`, `p_limit`, `p_cursor_created_at`, `p_cursor_id` | `placesRepository` |
| `toggle_list_place_like` | `target_place_id` | `placesRepository` |
| `toggle_list_place_comment_like` | `target_comment_id` | `placesRepository` |
| `notifications_page` | `p_limit`, `p_cursor_created_at`, `p_cursor_id` | `notificationQueryHelpers` |
| `notification_unread_count` | — | `notificationRepository` |
| `respond_to_follow_request` | `input_request_id`, `input_decision` | `notificationRepository` |
| `create_place_quote_notification` | `input_list_id`, `input_list_place_id`, `input_recipient_user_id`, `input_message` | `notificationRepository` |
| `upsert_user_push_token` | `input_token`, `input_platform`, `input_cleanup_secret` | `pushNotificationRepository` |
| `remove_user_push_token` | `input_token` | `pushNotificationRepository` |
| `remove_all_user_push_tokens` | — | `pushNotificationRepository` |
| `revoke_push_token_with_cleanup_secret` | `input_token`, `input_cleanup_secret` | `pushTokenCleanup` (oturumsuz) |

**Akış kartı satırları.** `feed_page_complete`, `explore_page_complete`
(`p_kind = 'places'`) ve `profile_content_page_complete` aynı kart şeklini
döner; istemcide tek eşleyici okur (`mapPlaceFeedCard`). Sayılar metin
gelebilir, `media` JSON metni gelebilir, bilinmeyen alanlar yok sayılır.
Ana sayfa satırları snake_case gelir ve bir kez yeniden adlandırılır.

## Değişiklik kuralı

Bir alan kaldırılmadan ya da tipi değiştirilmeden önce: eski ve yeni şekli
birlikte kabul eden bir sürüm yayınlanır, OTA cihazlara ulaşır, sonra eski
şekil kaldırılır. Yeni alan eklemek her zaman güvenlidir.
