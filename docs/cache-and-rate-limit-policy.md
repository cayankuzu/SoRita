# SoRita cache ve rate-limit politikası

Tarih: 2026-08-30

Kapsam: `infra/cloudflare/sorita-edge`

## Release durumu

**Production: NO-GO.** Aşağıdaki davranış Worker kodunda ve yerel Workerd testlerinde uygulanmıştır.
Cloudflare dashboard Cache Rules, WAF/Rate Limiting Rules, DNS/proxy, canlı Worker deploy'u, gerçek
namespace sayaçları, alarm panoları ve rollback kanıtı **UNVERIFIED**'dır. Repository policy'si canlı
edge davranışının tek başına kanıtı değildir.

## Temel kararlar

- Supabase Auth/Postgres/RLS/Realtime/Storage source of truth olarak kalır.
- Worker kullanıcıya özel API cevabı, oturum, JWKS, idempotency kaydı veya uygulama verisi cache'lemez.
- Cloudflare'a R2, KV, D1, Queue, Pages veya Durable Object eklenmemiştir.
- Bütün Worker cevapları shared ve browser HTTP cache'leri için `private, no-store`'dur.
- Cloudflare Rate Limiting binding yalnız coarse abuse control'dür; kesin iş kotası, bakiye, lockout,
  faturalama sayacı veya global idempotency mekanizması değildir.
- Origin'e mutation tam bir kez gönderilir; Worker retry veya direct-origin fallback yapmaz.

## Cache politikası

### Response matrisi

| Cevap sınıfı | `Cache-Control` | Ek başlıklar | Cache edilebilir veri |
| --- | --- | --- | --- |
| `GET /health` | `private, no-store, max-age=0` | `Pragma: no-cache`, `Expires: 0`, `X-Request-Id` | yok |
| Başarılı proxy `2xx/204` | `private, no-store, max-age=0` | güvenlik ve korelasyon başlıkları | yok |
| Client/auth/rate hatası `4xx` | `private, no-store, max-age=0` | sanitize JSON; gerektiğinde `Allow`/`Retry-After` | yok |
| Worker/origin hatası `5xx` | `private, no-store, max-age=0` | sanitize JSON | yok |
| Browser preflight `204` | `private, no-store, max-age=0` | exact CORS; `Access-Control-Max-Age: 600` | yalnız browser preflight izni, uygulama cevabı değil |

`Access-Control-Max-Age: 600`, browser'ın başarılı preflight kararını en fazla 600 saniye kendi özel
preflight cache'inde tutabilmesine izin verir. Bu, health veya kullanıcı API gövdesinin HTTP/CDN
cache'ine alınmasına izin vermez.

Allowed browser isteğinde exact `Access-Control-Allow-Origin` ve `Vary: Origin` eklenir. Native
`Origin`-absent cevapta CORS başlığı yoktur. CORS, response isolation veya authentication yerine
geçmez.

### Origin cevabı aktarım kuralları

Worker origin cevabının header set'ini istemciye kopyalamaz; güvenli header set'ini yeniden kurar.
Böylece origin `Set-Cookie`, `Cache-Control`, `Expires`, `ETag` veya cache'e sebep olabilecek diğer
başlıklar edge cevabına taşınmaz. `2xx` ve `4xx` JSON gövdeleri stream edilebilir; durum kodu korunur.

- Origin `429`: gövde atılır, sanitize `rate_limited` JSON üretilir. `Retry-After` yalnız 1–6 basamaklı
  saniye veya parse edilebilir HTTP-date ve en çok 128 karakter ise korunur; aksi halde `60`.
- Origin `3xx` veya `5xx`: gövde atılır, `502 origin_unavailable`.
- Origin timeout: `504 origin_timeout`.
- `204` dışındaki JSON olmayan cevap: `502 invalid_origin_response`.

Worker hiçbir response'u `caches.default` ile yazmaz ve `fetch` için edge cache talep etmez. JWKS
isteği `cache: no-store` ile yapılır ve Worker process'inde kalıcı key cache'i tutulmaz. Bu tercih,
Supabase JWKS availability/latency bağımlılığı yaratır; canlı alarm ve SLO kanıtı gerektirir.

### Cache değişmezleri

1. Kullanıcı A ile alınan cevap kullanıcı B'ye yeniden kullanılamaz.
2. Bearer token, `Set-Cookie`, private media URL'si veya auth cevabı shared cache'e yazılamaz.
3. Health dahil hiçbir path için “public cache” istisnası yoktur.
4. Dashboard Cache Rule/Page Rule, Worker'ın `no-store` kararını override edemez.
5. Cache purge release veya rollback mekanizması değildir; çünkü bu gateway veri cache'lemez.

Dashboard Cache Rules ve canlı `CF-Cache-Status`/tekrarlı-isolation kanıtı **UNVERIFIED** olduğundan
production kararı **NO-GO**'dur.

## Rate-limit politikası

### Checked-in binding değerleri

| Ortam | Binding | Namespace ID | Limit | Periyot | Not |
| --- | --- | ---: | ---: | ---: | --- |
| yerel varsayılan | `AUTH_RATE_LIMITER` | `86083000` | 30 | 60 s | placeholder |
| yerel varsayılan | `API_RATE_LIMITER` | `86083001` | 120 | 60 s | placeholder |
| development | `AUTH_RATE_LIMITER` | `86083010` | 30 | 60 s | placeholder |
| development | `API_RATE_LIMITER` | `86083011` | 120 | 60 s | placeholder |
| preview | `AUTH_RATE_LIMITER` | `86083020` | 30 | 60 s | placeholder |
| preview | `API_RATE_LIMITER` | `86083021` | 120 | 60 s | placeholder |
| production | `AUTH_RATE_LIMITER` | `86083030` | 30 | 60 s | placeholder; NO-GO |
| production | `API_RATE_LIMITER` | `86083031` | 120 | 60 s | placeholder; NO-GO |

Bu namespace ID'leri yalnız yapılandırma placeholder'ıdır. Cloudflare hesabında pozitif integer ve
benzersiz oldukları doğrulanmamıştır. Aynı namespace ID'sini kullanan binding'ler aynı anahtar için
sayaç paylaşabildiğinden, yetkili operatör her ortam/binding için ayrılığı dashboard/API çıktısıyla
kanıtlamalıdır.

### Route ataması

| Route | Binding | Limit anahtarındaki action |
| --- | --- | --- |
| `/v1/auth-gateway` | `AUTH_RATE_LIMITER` | payload `action` |
| `/v1/maps-geocoding` | `API_RATE_LIMITER` | `search` veya `reverse` |
| `/v1/moderation-reports` | `API_RATE_LIMITER` | `targetType`: `user/list/place/comment` |
| `/v1/media-assets` | `API_RATE_LIMITER` | media `action` |
| `/v1/delete-user` | `API_RATE_LIMITER` | `delete-user` |
| `/health` ve `OPTIONS` | yok | yok |

Limit route toplamı değildir; anahtar action'ı da içerdiği için her actor/route/action kombinasyonu
ayrı sayılır. Örneğin aynı kullanıcı için maps `search` ve `reverse` ayrı P120 sayaçlarıdır. Bu
ayrım, her action'ın izin verilen kapasitesi olarak ele alınmalı; birleşik kullanıcı kotası olarak
yorumlanmamalıdır.

### Actor anahtarı ve gizlilik

```text
Authenticated:
user:<verified Supabase JWT UUID sub>:<route>:<action>

Anonymous public auth:
ip:<base64url HMAC-SHA256(IP_HASH_PEPPER, CF-Connecting-IP)>:<route>:<action>
```

- Bearer token varsa JWT tam doğrulanmadan user key üretilemez. Public action'a geçersiz token
  göndermek anonymous fallback sağlamaz; `401` döner.
- Public action token olmadan çağrılırsa raw IP rate binding anahtarına veya loga yazılmaz; ortamın
  en az 32 karakterlik `IP_HASH_PEPPER` secret'ıyla HMAC'lenir.
- `CF-Connecting-IP` yok/geçersiz ise `503 client_identity_unavailable`; sabit ortak fallback anahtarı
  kullanılmaz.
- HMAC-IP yalnız anonymous abuse için zorunlu fallback'tir. Mobil operatör NAT'ı veya privacy proxy
  çok sayıda meşru kullanıcıyı aynı IP'de birleştirebilir; bu nedenle yanlış-pozitif riski izlenir.
- Authenticated UID raw değeri binding anahtarında kullanılabilir, fakat structured log ve response'a
  yazılmaz.
- `IP_HASH_PEPPER` ve `ORIGIN_HMAC_SECRET` farklı ve ortam bazında ayrı olmalıdır.

### İşlem sırası ve fail-closed davranış

```text
config -> CORS/path/method -> bounded JSON -> strict schema/action
       -> JWT/actor check -> Rate Limiting binding -> origin HMAC -> tek origin fetch
```

Bu sıra nedeniyle malformed path/method/body/action/JWT denemeleri Worker binding sayacını tüketmez.
Bunların volumetric ve credential-stuffing etkisi Cloudflare WAF/bot/body/method katmanında ayrıca
sınırlandırılmalıdır. Bu dış katman **UNVERIFIED**'dır.

| Durum | Worker sonucu | Origin çağrısı |
| --- | --- | --- |
| Binding `{ success: false }` | `429 rate_limited`, `Retry-After: 60` | yapılmaz |
| Binding throw/unavailable | `503 rate_limit_unavailable` | yapılmaz |
| Anonymous IP yok/geçersiz | `503 client_identity_unavailable` | yapılmaz |
| JWT verifier unavailable | `503 auth_verifier_unavailable` | yapılmaz |
| Origin `429` | sanitize `429`; valid origin `Retry-After` veya 60 | tek çağrı yapılmıştır |

Cloudflare Rate Limiting API aynı Cloudflare lokasyonunda asynchronous/eventually consistent ve
permissive sayaçlar kullanır; farklı lokasyonlarda aynı key için ayrı limit vardır. Bu nedenle:

- “tam olarak 30/120'de keser” garantisi yoktur.
- Global login lockout, fraud kararı veya ücretlendirme sayacı olamaz.
- Exact business quota ve yarışa dayanıklı idempotency Supabase/Postgres'te atomik uygulanmalıdır.
- WAF Rate Limiting Rules ilk katman; Worker binding doğrulanmış route/action'a yakın ikinci katmandır.

WAF rule ID/config/export, dashboard screenshot/API çıktısı ve canlı çok-POP testi **UNVERIFIED**'dır.

## Idempotency ve retry ilişkisi

Rate-limit, idempotency değildir. Worker:

- `Idempotency-Key` değerini varsa 1–200 görünür ASCII karakter olarak doğrular ve origin'e aktarır.
- Bu anahtarı saklamaz, tekrarını aramaz ve önceki cevabı döndürmez.
- Origin POST'u otomatik retry etmez, redirect takip etmez ve gateway hatasında direct fallback yapmaz.
- Her origin çağrısında yeni edge HMAC nonce'ı üretir; bu nonce business idempotency key değildir.

İstemci, ağ altyapısı veya kullanıcı yine aynı niyeti tekrar gönderebilir. Mutating action'ların exact
dedupe/claim sözleşmesi Supabase/Postgres'te kalır. Depoda `delete-user` için resumable claim kanıtı
bulunması diğer action'lar için genel idempotency garantisi oluşturmaz.

## Ölçüm ve alarm gereksinimleri

Structured Worker log'ları route, action, actor class, status, duration, environment, request ID,
`CF-Ray` ve stable error code içerir; token, user ID, raw IP, body veya secret içermez. Başarılı log
örnekleme development'ta 1, preview'da 0,25, production'da 0,10; tüm hatalar loglanır.

Production öncesi aşağıdaki alarmlar canlıda kanıtlanmalıdır:

- Route/action bazında `429`, `502`, `503`, `504` oranı ve p95/p99 latency.
- `rate_limit_unavailable`, `auth_verifier_unavailable`, `configuration_unavailable` ayrı alarmı.
- Authenticated/anonymous oranı ve public auth WAF deny trendi; PII içermeyen agregasyon.
- Supabase origin `429`, Worker binding `429` ve WAF deny ayrımı.
- Direct-origin HMAC missing/invalid/replay reject sayısı.
- Cache HIT olmaması ve kullanıcı A/B response isolation canary'si.

Workers Logs/Traces yapılandırması repoda açıktır; dashboard veri gelişi, retention, alarm ve erişim
kontrolü **UNVERIFIED**'dır.

## Değişiklik yönetimi

Cache veya rate ayarı ancak şu kanıtlarla değiştirilebilir:

1. Route/action trafik dağılımı ve yanlış-pozitif analizi.
2. Preview yük/abuse testi; en az iki Cloudflare lokasyonu için yorumlanan sonuç.
3. Supabase origin kapasitesi ve atomik business-limit kontrollerinin doğrulanması.
4. Worker contract testlerinin, no-store/A-B isolation ve fail-closed testlerinin PASS olması.
5. Environment'a benzersiz namespace, dashboard/WAF export'u ve iki kişi onayı.
6. Canary planı, alarm eşikleri, önceki değer/version ve çalıştırılmış rollback adımı.

Limit artırımı güvenlik kontrolünü sessizce gevşetemez; azaltım paylaşılan IP/normal kullanıcı etkisini
ölçmeden yapılamaz. Cache için kullanıcıya özel route istisnası açılamaz.

## Production doğrulama listesi

- [ ] Production custom route/domain ve orange-cloud DNS kanıtı.
- [ ] `workers.dev` exposure kararı ve dashboard çıktısı.
- [ ] Cache Rules/Page Rules export'u; seçili yollar için hiçbir cache override yok.
- [ ] WAF/body/method/bot/credential-stuffing kuralları ve rule ID'leri.
- [ ] Gerçek ve benzersiz production Rate Limiting namespace ID'leri.
- [ ] Ortama özel secret kurulumu ve rotation kaydı.
- [ ] Canlı binding deny/failure ile `429/503` smoke kanıtı.
- [ ] Çok-POP davranış testi ve false-positive kabulü.
- [ ] User A/B no-cache izolasyon testi; hiçbir response `HIT` değil.
- [ ] Workers Logs/Traces veri, alarm ve PII-redaction doğrulaması.
- [ ] Deploy SHA/version, canary onayı ve önceki version'a rollback tatbikatı.

Bu maddeler şu anda **UNVERIFIED**'dır; tamamlanmadan production **NO-GO** kalır.

## Birincil kaynaklar

- [Cloudflare Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
