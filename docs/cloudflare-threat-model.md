# SoRita Cloudflare tehdit modeli

Tarih: 2026-08-30

Kapsam: seçici `sorita-edge` Worker ingress'i, mobil cutover ve seçili Supabase Edge Functions

## Karar ve kanıt seviyesi

**Production release: NO-GO.** Depo içindeki Worker güvenlik kontrolleri ve yerel Workerd testleri
mevcuttur. Cloudflare dashboard, account/zone, WAF, bot koruması, DNS/proxy, custom domain/route,
gerçek secret/namespace, canlı deploy, Supabase origin HMAC enforcement, canary ve rollback kanıtları
**UNVERIFIED**'dır. Bu tehdit modeli yalnız doğrulanmış yerel gerçekleri “uygulanmış” sayar.

## Güvenlik hedefleri

- Seçili yüksek-riskli çağrıların yalnız exact route/action/body/auth sözleşmesiyle origin'e ulaşması.
- Kullanıcı kimliğinin istek gövdesinden değil kriptografik olarak doğrulanmış Supabase JWT `sub`
  değerinden türetilmesi.
- Supabase Auth/Postgres/RLS/Realtime/Storage'ın source of truth kalması; Cloudflare'da ikinci bir
  yetki, veri veya dosya deposu oluşmaması.
- Bir kullanıcının authenticated cevabının başka kullanıcıya veya paylaşılan cache'e sızmaması.
- Origin mutation'larının edge tarafından otomatik tekrar edilmemesi.
- Worker-origin arasındaki gövde, yöntem ve canonical yolun HMAC ile bağlanması; origin'de freshness
  ve atomic nonce kontrolü ile replay'in reddedilmesi.
- Token, secret, e-posta, request body, raw IP ve user ID'nin loglara girmemesi.
- Cloudflare güvenlik katmanı arızalandığında origin'e fail-open geçiş olmaması.

## Kapsam dışı veya eklenmeyen bileşenler

Bu değişiklik **R2, KV, D1, Queue, Pages veya Durable Object eklemez**. Worker'da uygulama durumu
tutan global `Map`/`Set` yoktur. Cloudflare Rate Limiting binding'in yönetilen sayaçları kalıcı iş
verisi, idempotency ledger'ı veya global kesin kota değildir. Asıl yetkilendirme ve veri bütünlüğü
Supabase Auth, RLS, RPC/constraint ve Edge Function iş kurallarında kalır.

## Korunan varlıklar

- Supabase kullanıcı access token'ları, oturumlar ve kullanıcı kimliği.
- Publishable key, `ORIGIN_HMAC_SECRET`, `IP_HASH_PEPPER` ve deploy kimlikleri.
- Profil, takip/blok, liste, yer, yorum, moderation report ve account-deletion verisi.
- Özel medya yolları, imzalı upload/read URL'leri ve Supabase Storage nesneleri.
- Request ID, `CF-Ray`, rate sayaçları, güvenlik logları ve alarm sinyalleri.
- Cloudflare zone/DNS/route/WAF/Worker version ayarları ve Supabase function configuration.

## Aktörler

- Anonim normal kullanıcı ve public auth akışları.
- Doğrulanmış kullanıcı; engellenmiş veya özel hesap ilişkili kullanıcı.
- Kötücül istemci, değiştirilmiş mobil binary, bot, credential-stuffing aktörü.
- Paylaşılan NAT/proxy arkasındaki birden fazla meşru kullanıcı.
- Çalınmış bearer token kullanan saldırgan veya ele geçirilmiş cihaz.
- Cloudflare/Supabase secret'ına ya da dashboard hesabına erişen saldırgan/insider.
- Yetkili release operatörü ve yanlış yapılandırma yapan iyi niyetli operatör.
- Cloudflare, Supabase Auth/JWKS, Edge Functions veya Storage availability arızası.

## Güven sınırları

1. İstemci -> Cloudflare ingress: tüm method/path/query/header/body saldırgan kontrollüdür.
2. Cloudflare Worker -> Supabase JWKS: public key dokümanı dış ağdan gelir; HTTPS, boyut, JSON şeması,
   issuer/audience/algoritma ve timeout ile sınırlandırılır.
3. Cloudflare Worker -> seçili Supabase Edge Function: bearer kullanıcıya aittir; publishable key
   yetki yükseltmez; edge HMAC yalnız origin doğrularsa server identity sağlar.
4. Supabase Edge Function -> Auth/Postgres/RLS/Storage: servis rolü kullanılabilecek ayrı ve yüksek
   riskli origin sınırıdır; Worker doğrulaması RLS/iş yetkilendirmesini kaldırmaz.
5. İstemci -> imzalı Supabase Storage URL: dosya Worker'ı atlar; signed URL kapsamı, metadata ve
   finalize kontrolleri origin/Storage sorumluluğudur.
6. Repo/CI -> Cloudflare ve Supabase dashboard/deploy: canlı yetki ve config depo testleriyle
   kanıtlanamaz; ayrı onay ve retained evidence gerekir.

## Tehdit ve kontrol matrisi

| ID | Tehdit / abuse case | Depo içinde mevcut kontrol | Kalan risk / zorunlu kontrol | Risk ve durum |
| --- | --- | --- | --- | --- |
| CF-01 | Saldırgan Worker'ı atlayıp seçili Supabase function URL'sini doğrudan çağırır | Mobil seçici gateway modu ve Worker'ın origin HMAC üretimi var; otomatik direct fallback yok | Origin beş function'da HMAC, freshness ve atomic nonce'ı enforce etmeli; doğrudan negatif test saklanmalı | **CRITICAL — UNVERIFIED, NO-GO** |
| CF-02 | Sahte, süresi geçmiş, yanlış issuer/audience/alg JWT ile kullanıcı taklidi | ES256/RS256 JWKS doğrulaması; exact issuer/audience; `exp`, `nbf`, UUID `sub`; invalid token `401` | Canlı Supabase asymmetric key ve rotasyon prova edilmeli; token çalınması hâlâ oturum tehdididir | HIGH; live key UNVERIFIED |
| CF-03 | JWKS endpoint bozuk, aşırı büyük, redirect veya timeout ile auth bypass/DoS | HTTPS Supabase origin, 64 KiB sınır, JSON/JWKS schema, manual redirect, 2,5/3 s timeout; hata `503` fail-closed | JWKS her doğrulamada alındığı için availability/latency bağımlılığı; alarm ve Supabase SLO gerekir | MEDIUM; live SLO UNVERIFIED |
| CF-04 | Credential stuffing, login/register/reset spam'i | Public action allowlist; AUTH binding 30/60; anonim anahtar HMAC-hash IP; origin auth limiti korunur | Binding POP-yerel/eventually consistent; invalid şema/token binding'i tüketmez; paylaşılan IP yan etkisi var. WAF/bot/credential kuralları gerekir | HIGH; WAF UNVERIFIED |
| CF-05 | Route traversal, query/trailing slash, method confusion veya action genişletme | Exact altı yol; query reddi; route başına method; strict discriminated schema; unknown alan/action reddi | Dashboard route genişliği ve DNS'in doğru Worker'a gitmesi kanıtlanmalı | HIGH; DNS/route UNVERIFIED |
| CF-06 | Büyük/sıkıştırılmış/malformed body ile bellek veya parser istismarı | Route başına 1–64 KiB byte sınırı; stream okuma; `Content-Length` ve gerçek byte sayımı; yalnız UTF-8 JSON; compression reddi | Worker'a ulaşmadan önceki volumetric trafik WAF/DDoS katmanına bağlıdır | MEDIUM; WAF/DDoS evidence UNVERIFIED |
| CF-07 | Media baytlarını base64 ile Worker/origin üzerinden geçirerek limit veya veri akışı bypass'ı | `action=upload` ve üst seviye `fileBase64` -> `413`; yalnız control-plane action'lar; dosya signed URL ile doğrudan Storage'a | Nested/alternatif origin yolları ve signed URL scope/finalize kuralları Supabase testleriyle korunmalı | HIGH; live Storage policy UNVERIFIED |
| CF-08 | Worker-origin isteğinin gövde/yol/yöntem olarak değiştirilmesi | Timestamp + UUID nonce + exact body hash + method + canonical path üzerinde HMAC; secret en az 32 karakter | Origin doğrulaması yoksa HMAC etkisizdir; secret iki uçta ayrı environment ile saklanmalı | **CRITICAL — enforcement UNVERIFIED** |
| CF-09 | Geçerli edge HMAC isteğinin replay edilmesi | Worker kriptografik yeni nonce üretir | Random nonce tek başına replay'i engellemez; origin kısa timestamp penceresi ve Postgres unique/atomic nonce claim'i yapmalı | **CRITICAL — replay gate UNVERIFIED** |
| CF-10 | Ağ timeout/retry ile çift mutation, çift e-posta, çift report veya çift finalize | Worker origin'i bir kez çağırır; redirect/retry/direct fallback yok; optional idempotency header yalnız validate+forward edilir | İstemci veya upstream tekrar edebilir. Mutation idempotency'si origin/Postgres'te olmalı; yalnız account-deletion claim'i depoda açıkça resumable tasarlanmıştır | HIGH; per-action live proof UNVERIFIED |
| CF-11 | IDOR: başka kullanıcı adına availability exclusion/report/delete/private-media işlemi | JWT `sub`; availability `excludeUserId` ve moderation `reporterUserId` actor eşleşmesi; korunan route'larda JWT | Media path ownership, deletion scope ve bütün nesne yetkileri origin/RLS'de doğrulanmaya devam etmeli | HIGH; DB/staging evidence UNVERIFIED |
| CF-12 | Authenticated response'un edge/shared cache üzerinden kullanıcılar arasında sızması | Her cevap private/no-store; origin cookie/cache başlıkları atılır; kullanıcı A/B izolasyon testi | Dashboard Cache Rule/Page Rule header'ı override etmemeli; canlı cache status testi gerekir | **HIGH — dashboard UNVERIFIED** |
| CF-13 | CORS'u auth sanmak veya sahte Origin ile native erişimi engel/aşmak | Browser origin exact allowlist; native `Origin` olmadan kabul; JWT/HMAC ayrı kontrollerdir | Kötücül native istemci CORS ile durmaz; auth/RLS/rate-limit şarttır | MEDIUM; tasarım gereği |
| CF-14 | `CF-Connecting-IP`, request-signature veya correlation header spoof/smuggling | IP dar format/uzunluk; istemci güvenlik başlıkları dar regex; Worker kendi request UUID'sini üretir; `CF-Ray` sanitize edilir | Güvenilir Cloudflare ingress/DNS şarttır; origin yalnız edge HMAC enforcement sonrası edge metadata'ya güvenmeli | HIGH; ingress UNVERIFIED |
| CF-15 | Secret'ın loga/cevaba sızması veya environment'lar arası reuse | Secret'lar `secrets.required`; config en az uzunluk ve HMAC/pepper ayrılığı; structured redacted log; sanitized error | Dashboard secret kurulumu, erişim kontrolü, rotasyon ve log sink retention kanıtı gerekir | HIGH; dashboard/rotation UNVERIFIED |
| CF-16 | Origin `Set-Cookie`, cache header, HTML/redirect veya hassas `5xx` body enjekte eder | Worker response header'larını yeniden kurar; cookie/cache aktarmaz; redirect/5xx/non-JSON sanitize edilir; 429 body sanitize edilir | Origin 2xx/4xx JSON gövdesi hâlâ API sözleşmesine uymalı; response schema client/origin sorumluluğu | MEDIUM |
| CF-17 | Rate-limit'i POP dağılımı, çoklu IP veya çoklu action ile aşma | Anahtar actor + route + action; ayrı auth/api binding; binding arızası fail-closed | Sayaçlar global kesin değildir; WAF ve atomik Supabase iş kotası/lockout gerekir | HIGH; WAF/business quota UNVERIFIED |
| CF-18 | Yanlış production URL/CORS/namespace/timeout veya açık `workers.dev` ile config drift | Runtime config fail-closed; üç named env; placeholder değerler açıkça işaretli; generated types/test | Dashboard ile checked-in config karşılaştırması, unique namespace ve production custom route kararı gerekir | **HIGH — UNVERIFIED, NO-GO** |
| CF-19 | Kötü deploy sonrası uzun kesinti; rollback'in çalışmaması | Kodda deploy yok; aşamalı rollout/rollback planı belgeli | Önceki version ID, yetkili komut/runbook, rollback tatbikatı ve toparlanma ölçümü yok | **HIGH — UNVERIFIED, NO-GO** |

## Fail-closed davranış özeti

- Geçersiz runtime config veya eksik güvenli client identity: `503`, origin çağrılmaz.
- Geçersiz/missing JWT: `401`; JWKS verifier kullanılamazsa `503`.
- Actor mismatch: `403`.
- Rate binding arızası: `503`; limit: `429` + `Retry-After: 60`.
- Origin timeout: `504`; network error/redirect/`5xx`/non-JSON: sanitize `502`.
- Bilinmeyen route/action/alan, query, method, content type, encoding ve body sınırı origin'e geçmez.
- Worker hatasında direct Supabase fallback yoktur.

Bu davranışlar availability yerine bypass'e direnç önceliği verir. Bir dependency kesintisinde işlemin
başarısız olması kabul edilir; sessizce daha az korumalı yola geçmesi kabul edilmez.

## Zorunlu abuse ve negatif test kanıtları

Yerel Worker testlerine ek olarak preview/staging'de aşağıdaki kanıtlar saklanmalıdır:

1. Her route/action için Worker üzerinden geçerli çağrı ve direct Supabase URL'ye HMAC'sız çağrının
   reddi.
2. HMAC'ta body, path, method, timestamp ve signature'ın ayrı ayrı değiştirilmesi; duplicate nonce;
   pencerenin hemen içi/dışı.
3. User A token'ıyla User B `excludeUserId`, `reporterUserId`, media path ve account-deletion IDOR
   denemeleri.
4. Her public auth action'ında WAF/bot/credential-stuffing testi; farklı POP/IP dağılımında binding'in
   kaba/permissive karakterinin ölçülmesi.
5. `Content-Length` var/yok, chunked sınır aşımı, compression, malformed UTF-8/JSON, unknown alan,
   query ve trailing slash.
6. İki kullanıcı arasında cache sızıntısı; allowed/disallowed Origin; native Origin-absent; preflight.
7. Origin timeout, network error, 429, redirect, HTML ve hassas 5xx gövdesinde tek origin çağrısı ve
   sanitize cevap.
8. `upload`/`fileBase64` reddi ve medya baytlarının yalnız signed Storage URL'sine gittiğinin ağ izi.
9. HMAC/IP pepper rotation, eski key reject, log ve response secret/PII taraması.
10. Canary sırasında alarm tetikleme ve önceki Worker version'ına gerçek rollback tatbikatı.

## Release kabul ölçütü

Production `GO` kararı ancak aşağıdakilerin tamamı retained evidence ile doğrulanırsa yeniden
değerlendirilebilir:

- Cloudflare account/zone, DNS proxy, custom route/domain ve `workers.dev` kararı.
- Dashboard WAF, body/method/bot/rate katmanları ve cache bypass kuralları.
- Ortama özel secrets ve benzersiz Rate Limiting namespace ID'leri.
- Supabase asymmetric signing key/JWKS ve key rotation prova sonucu.
- Beş origin function'da edge HMAC + freshness + atomic nonce enforcement.
- Direct-origin negatif matrisi, preview smoke/load ve canary SLO'ları.
- Deploy SHA/Worker version, onay kaydı, önceki version ve rollback tatbikatı.

Bunların herhangi biri **UNVERIFIED** ise karar **NO-GO** kalır.

## Birincil kaynaklar

- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Workers Rate Limiting locality ve accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Supabase JWT signing keys ve public JWKS](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase Edge Function auth başlıkları](https://supabase.com/docs/guides/functions/auth-headers)
