# SoRita Cloudflare mimarisi

Tarih: 2026-08-30

Kapsam: `infra/cloudflare/sorita-edge` ve seçici mobil yönlendirme sözleşmesi

## Release durumu

**Karar: NO-GO.** Worker kodu, yapılandırması ve Workerd sözleşme testleri yerelde mevcuttur; bu,
canlı Cloudflare veya Supabase ortamının hazır olduğunu kanıtlamaz. Cloudflare dashboard ayarları,
WAF kuralları, DNS/proxy kaydı, özel alan adı/route, gerçek namespace ve secret kurulumu, herhangi bir
development/preview/production deploy'u, canlı trafik testi ve rollback tatbikatı **UNVERIFIED**
durumdadır. Bu kanıtlar saklanmadan production release yapılamaz.

`UNVERIFIED`, ilgili kontrolün yok olduğu iddiası değil; depo içinden veya yetkili canlı ortamdan
kanıtlanmadığı ve bu nedenle release kapısını geçemediği anlamına gelir.

## Değişmez mimari sınırlar

1. **Supabase source of truth olarak kalır.** Kullanıcı kimliği ve oturumu Supabase Auth'ta; kalıcı
   uygulama verisi ve idempotency/iş kuralları Postgres/RLS'de; Realtime Supabase Realtime'da; medya
   nesneleri Supabase Storage'dadır. Cloudflare Worker bunların hiçbirinin kopyası veya yeni otoritesi
   değildir.
2. Worker yalnız mevcut beş Edge Function sınırında seçici bir güvenlik ve yönlendirme katmanıdır:
   `auth-gateway`, `maps-geocoding`, `moderation-reports`, `media-assets` ve `delete-user`.
3. Genel amaçlı `/functions/v1/*` proxy'si yoktur. Tam yol, yöntem, JSON boyutu, action ve şema
   allowlist ile doğrulanır; sorgu dizeleri ve sondaki `/` reddedilir.
4. Medya baytları Worker'dan geçmez. Worker yalnız imzalı upload/read URL kontrol çağrılarını ve
   finalize/delete kontrol mesajlarını geçirir; dosya istemciden imzalı URL ile doğrudan Supabase
   Storage'a gider.
5. Cloudflare tarafına **R2, KV, D1, Queue, Pages veya Durable Object eklenmemiştir**. Uygulama verisi
   için edge kalıcılığı ve process-içi `Map`/`Set` durum deposu yoktur. Yalnız Cloudflare'ın yönetilen,
   kaba Rate Limiting binding sayaçları kullanılır; bunlar iş verisinin source of truth'u değildir.
6. Worker hiçbir `service_role` secret'ı taşımaz. Origin'e yalnız ortamın publishable/anon anahtarı,
   varsa doğrulanmış kullanıcının özgün bearer token'ı ve doğrulanmış istemci güvenlik başlıkları
   aktarılır.

## Veri akışı

```text
Mobil/web istemci
  |
  | EXPO_PUBLIC_EDGE_CUTOVER_MODE
  +-- direct  --------------------------> Supabase (geçiş öncesi varsayılan)
  |
  +-- gateway, yalnız seçili fonksiyonlar
        |
        v
  Cloudflare Worker: sorita-edge
    exact route/method/CORS/body/schema
    -> gerekirse Supabase JWKS ile JWT doğrulama
    -> UID veya HMAC(IP) anahtarlı rate-limit
    -> origin HMAC + request/correlation başlıkları
        |
        v
  Supabase Edge Functions
        |
        +--> Supabase Auth
        +--> Postgres + RLS/RPC  <-- kalıcı veri ve iş kuralı otoritesi
        +--> Supabase Storage   <-- medya nesnesi otoritesi

İmzalı medya URL'si alındıktan sonra:
Mobil istemci --------------------------------> Supabase Storage
                         dosya baytları doğrudan
```

Seçilmeyen Supabase çağrıları gateway modunda da mevcut doğrudan Supabase yolunu kullanır. Ağ
hatasında seçili bir çağrı Worker'dan doğrudan origin'e otomatik düşmez ve Worker origin mutation'ını
yeniden denemez.

## Worker sorumlulukları

Worker'ın kanıtlanmış depo-içi sorumlulukları şunlardır:

- Her istekte yeni kriptografik request ID üretmek; geçerli `CF-Ray` değerini korelasyon için taşımak.
- Browser isteklerinde birebir `CORS_ALLOWLIST` eşleşmesi aramak; `Origin` bulunmayan native istekleri
  kabul etmek. CORS hiçbir zaman authentication yerine kullanılmaz.
- İstek gövdesini `Content-Length` olmasa da byte sınırıyla stream ederek okumak; sıkıştırılmış,
  JSON olmayan, geçersiz UTF-8 veya şema dışı girdiyi origin'e ulaşmadan reddetmek.
- Korunan action'larda Supabase JWT'yi JWKS üzerinden ES256/RS256 imzası, issuer, audience, `exp`,
  `nbf` ve UUID `sub` ile doğrulamak. JWKS alınamazsa fail-closed `503`, token geçersizse `401`
  döndürmek.
- Rate Limiting binding'i origin çağrısından önce çalıştırmak; binding arızasında fail-closed `503`,
  limitte `429` ve `Retry-After: 60` döndürmek.
- Her proxied POST için tam iletilen gövdeyi ve canonical origin yolunu kapsayan HMAC üretmek.
- Origin'e tam bir kez, `redirect: manual` ve ortam timeout'u ile gitmek; `5xx`, redirect veya JSON
  olmayan cevabı sanitize etmek.
- Health, error, preflight ve origin cevapları dahil her yanıta
  `Cache-Control: private, no-store, max-age=0` eklemek ve origin cookie/cache başlıklarını taşımamak.
- PII/token/body/user ID/raw IP/secret içermeyen yapılandırılmış log üretmek.

Detaylı sözleşme [cloudflare-route-matrix.md](./cloudflare-route-matrix.md), cache ve limit davranışı
[cache-and-rate-limit-policy.md](./cache-and-rate-limit-policy.md), riskler ise
[cloudflare-threat-model.md](./cloudflare-threat-model.md) içindedir.

## Ortam modeli

| Ortam | Worker adı | Origin timeout | JWKS timeout | Başarılı log örnekleme | Durum |
| --- | --- | ---: | ---: | ---: | --- |
| yerel varsayılan | `sorita-edge-local` | 10.000 ms | 3.000 ms | 1,00 | placeholder config |
| development | `sorita-edge-development` | 10.000 ms | 3.000 ms | 1,00 | deploy UNVERIFIED |
| preview | `sorita-edge-preview` | 8.000 ms | 2.500 ms | 0,25 | deploy UNVERIFIED |
| production | `sorita-edge-production` | 8.000 ms | 2.500 ms | 0,10 | deploy UNVERIFIED; NO-GO |

Tüm `4xx/5xx` cevaplar örnekleme oranından bağımsız loglanır. Checked-in Supabase URL'leri,
`.invalid` CORS origin'leri ve rate namespace ID'leri placeholder'dır. Production ayarında
`workers_dev: false` ve `preview_urls: false` production için fail-closed kapıdır. Kaynakta bilinmeyen bir hostname
uydurulmaz; onaylı özel domain/route eklenene kadar production Worker'ın erişilebilir ingress'i
yoktur ve deploy NO-GO kalır.

## Direct-origin kademeli kapatma planı

“Direct origin'i kapatmak”, Supabase seçili Edge Function URL'lerinin gizleneceği anlamına gelmez.
Gerekli güvenlik sonucu, bu fonksiyonların edge HMAC'ı olmayan veya geçersiz olan çağrıları handler
başında reddetmesidir. Supabase Auth/RLS ve mevcut istemci request-signature kontrolleri bunun yerine
geçmez; savunma katmanları birlikte kalır.

### Aşama 0 — Mevcut direct baseline

- `EXPO_PUBLIC_EDGE_CUTOVER_MODE=direct` kalır.
- Seçili fonksiyonlar doğrudan çağrılabilir; Worker deploy edilmemiş kabul edilir.
- Bu aşama production Cloudflare koruması sağlamaz ve release kararı **NO-GO**'dur.

### Aşama 1 — Preview hazırlığı

- Gerçek preview Supabase URL'si, exact CORS origin'i, benzersiz Rate Limiting namespace ID'leri ve
  ortama özel üç secret yetkili secret store üzerinden kurulur.
- Supabase projesinin JWKS'te kullanılabilir ES256/RS256 anahtar sunduğu doğrulanır.
- Worker preview'a deploy edilir; deploy SHA/version, dashboard ekranı ve smoke çıktısı saklanır.
- WAF/body/method/bot kuralları ile DNS/proxy/route kanıtı olmadan aşama tamam sayılmaz.

### Aşama 2 — Origin HMAC gözlem modu

- Beş seçili Supabase function aynı canonical mesajı doğrular: timestamp, nonce, `POST`, canonical
  `/functions/v1/<name>` yolu ve exact body SHA-256.
- İmza sabit zamanda karşılaştırılır; kısa freshness penceresi uygulanır; nonce replay kaydı
  Postgres'te atomik ve benzersiz tutulur. Worker belleği, KV veya başka eventual store replay
  otoritesi yapılmaz.
- İlk olarak geçerli/geçersiz/yok ölçümleri güvenli biçimde loglanır, fakat doğrudan çağrı geçici
  olarak kabul edilebilir. Gözlem süresi ve başarı ölçütü release kaydında yazılı olmalıdır.
- Bu origin doğrulaması ve canlı gözlem kanıtı şu anda **UNVERIFIED**'dır.

### Aşama 3 — Gateway canary

- Preview ve ardından production canary istemcileri `gateway` moduna alınır; seçilmeyen fonksiyonlar
  değişmez.
- Yüzdeler sırasıyla 1%, 5%, 25%, 50%, 100% yalnız hata oranı, auth `401/403`, Worker/origin `429`,
  `502/503/504`, p95 latency ve Supabase fonksiyon sağlığı kabul aralığındaysa artırılır.
- Gateway ağ hatasında direct fallback açılmaz. Aksi halde HMAC/WAF bypass yolu oluşur.

### Aşama 4 — Origin enforcement

- Yalnız tüm desteklenen uygulama sürümleri gateway kullandıktan ve gözlemde beklenmeyen doğrudan
  trafik kalmadıktan sonra seçili origin handler'ları edge HMAC'ı zorunlu kılar.
- Eksik, süresi geçmiş, body/path/method uyuşmayan, geçersiz imzalı veya tekrar kullanılan nonce'lı
  çağrılar fail-closed reddedilir.
- Doğrudan URL ile negatif test ve Worker üzerinden pozitif test, her action için saklanır.
- Enforcement ve bu kanıtlar **UNVERIFIED** olduğu sürece production release **NO-GO** kalır.

### Aşama 5 — Tam rollout ve işletim

- Custom domain/route, DNS, WAF, observability alarmı, secret rotation ve on-call runbook'u doğrulanır.
- Dashboard ile canlı 429/5xx/latency ve direct-origin reject metrikleri gözlenir.
- Aynı doğrulanmış Worker version'ı kademeli olarak production'a terfi ettirilir.

## Rollback sözleşmesi

- Worker sorunu: rollout durdurulur ve önceki doğrulanmış Worker version'ına geri dönülür.
- Origin enforcement sorunu: yalnız yetkili incident kararıyla kısa süreli gözlem/dual-accept moduna
  geri alınır; süre, etki ve kapanış koşulu kaydedilir. Auth/RLS veya client-signature kontrolleri
  kapatılmaz.
- Mobil config sorunu: OTA'nın kapsamı ve mağaza binary uyumluluğu doğrulanmadan gateway/direct
  değeri değiştirilmez; otomatik direct fallback eklenmez.
- HMAC secret şüphesi: yeni secret iki uçta koordineli döndürülür; geçiş penceresi ve eski secret'ın
  iptali kayıt altına alınır.
- Migration rollback yapılmaz; Supabase kalıcı veri tarafında forward-fix politikası korunur.

Canlı rollback tatbikatı, önceki Worker version ID'si, operatör/onay, süre ve SLO toparlanma kanıtı
**UNVERIFIED**'dır. Bunlar olmadan rollback “hazır” kabul edilemez.

## Production kanıt kapısı

| Kanıt | Depo içi durum | Canlı durum |
| --- | --- | --- |
| Worker route/security testleri | yerelde 3 dosya / 22 test PASS | UNVERIFIED |
| TypeScript, lint, generated Env types | yerelde PASS | n/a |
| Cloudflare account/zone sahipliği | depodan kanıtlanamaz | UNVERIFIED |
| Dashboard Worker config/version | depodan kanıtlanamaz | UNVERIFIED |
| WAF/bot/body/method kuralları | yalnız gereksinim belgeli | UNVERIFIED |
| DNS, orange-cloud proxy ve custom route/domain | placeholder config | UNVERIFIED |
| Secret ve namespace kurulumu | yalnız isim/placeholder var | UNVERIFIED |
| Supabase asymmetric signing key/JWKS | kod gereksinimi var | UNVERIFIED |
| Origin HMAC observation/enforcement/replay store | sözleşme belgeli | UNVERIFIED |
| Development/preview/production deploy | deploy komutu çalıştırılmadı | UNVERIFIED |
| Canary ve rollback tatbikatı | plan belgeli | UNVERIFIED |

## Birincil kaynaklar

- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Supabase JWT signing keys ve JWKS](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase Edge Function authorization headers](https://supabase.com/docs/guides/functions/auth-headers)
