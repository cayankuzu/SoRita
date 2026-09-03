# SoRita AAA-MVP — Nihai Yerel Doğrulama ve Release Kararı

Tarih: 2026-08-31

Branch: `chore/final-aaa-mvp-hardening-docker-cloudflare-ota`

Başlangıç HEAD: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`

Candidate SHA: henüz oluşturulmadı; çalışma ağacı değiştirilmiş durumdadır.

Kapsam: yalnız mevcut ürün yüzeyini güvenlik, dayanıklılık, test ve release
kanıtı açısından güçlendirme.

## 1. Kısa gerçek durum özeti

Mevcut SoRita ürün yüzeyi korunarak push token/teslim yaşam döngüsü, arka plan
bildirimi ve güvenilir tap yönlendirmesi, Supabase push operasyonları, seçici
Cloudflare Worker sözleşmeleri, OTA/native sınıflandırması, release evidence ve
Docker tabanlı deterministik doğrulama katmanı güçlendirildi. Sürüm kaynakları
`1.0.102`, Android `versionCode 107` ve iOS `buildNumber 87` olarak hazırlandı.

Yerel kanıtlar değerlidir fakat henüz immutable bir commit SHA'ya bağlanmamıştır.
İzole Supabase doğrulaması güncel migration setinde geçti; Worker ve hedefli
mobil/OTA testleri geçti; Worker preview/production dry-run'ları sentetik
secret'larla geçti. Buna karşılık hosted staging migration'ı, Cloudflare
provider/DNS/WAF/deploy/canary, Android+iOS aynı-SHA signed binary, iki platform
fiziksel cihaz, push provider receipt'leri, hosted restore, Sentry/store ve OTA
rollout kanıtları yoktur. Mevcut EAS hesabının Free planı EAS Update code
signing'i desteklemediğinden production signed OTA kapısı ayrıca fail-closed
durumdadır. Nihai karar **NO-GO**'dur.

## 2. Başlangıç ve final özellik listesi karşılaştırması

| Ürün yüzeyi | Başlangıç | Final | Sonuç |
| --- | ---: | ---: | --- |
| Kök rota | 10 | 10 | Korundu |
| Alt sekme | 4 | 4 | Korundu |
| Ekran girişi | 13 | 13 | Korundu |
| Bildirim türü | 10 | 10 | Korundu |
| Bildirim kategorisi | 6 | 6 | Korundu |
| Edge Function sözleşmesi | 6 | 6 | Korundu |
| Mobil Edge Function sözleşmesi | 5 | 5 | Korundu |
| Ürün tablosu | 18 | 18 | Korundu |
| Storage bucket | 3 | 3 | Korundu |
| Görünür Settings grubu | 3 | 3 | Korundu |
| Görünür Settings CTA | 19 | 19 | Korundu |

Başlangıç ve final son kullanıcı özellikleri aynıdır: auth, discovery/explore,
home, map, place, lists, social interactions, notifications, profile, settings,
fotoğraf/video upload ve account deletion. Yeni kullanıcı işi eklenmemiştir.

## 3. Yeni ekran/sekme/route/CTA/bildirim guard sonucu

`npm run feature-surface:check` yerel olarak geçti: 10 kök rota, 4 sekme, 13
ekran girişi, 10 bildirim türü, 6 Edge Function, 18 ürün tablosu, 3 bucket, 3
Settings grubu ve 19 Settings CTA; guard testleri 12/12. Bu sonuç yeni ürün
yüzeyi bulunmadığını gösterir. Candidate SHA henüz oluşmadığı için aynı kontrolün
temiz checkout/CI koşusu yine zorunludur.

## 4. Değiştirilen dosyalar

Aşağıdaki liste doküman kapanış anındaki ana değişiklik gruplarıdır; release için
tek kaynak, candidate commit'in `git diff --name-status <base>...<candidate>`
çıktısı olacaktır.

| Grup | Başlıca dosyalar |
| --- | --- |
| Mobil push | `index.js`; `src/mobile/app/app-shell/notifications/**`; `src/mobile/app/platform/notifications/**`; notification contract/repository ve testleri |
| Oturum ve config | `useAuthActions.ts`, `useAuthSessionLifecycle.ts`, `publicRuntimeConfig.ts`, `edgeFunctions.ts` ve testleri |
| Supabase push | `20260831120000_harden_push_delivery_operations.sql`, `20260831123000_fix_auth_login_guard_lint.sql`, `push_delivery_hardening.sql`, admin-broadcast Function ve logger kaynakları |
| Cloudflare | `infra/cloudflare/sorita-edge/src/**`, `test/**`, `wrangler.jsonc`, Worker package/lockfile ve README |
| Docker | `.dockerignore`, `infra/docker/**`, `.github/workflows/docker-validation.yml`, Docker guard ve root package scriptleri |
| OTA/build | `app.config.ts`, `android/app/build.gradle`, Android manifest/string kaynakları, `utils/eas/**`, EAS preview/production workflow'ları |
| Release/CI | Quality, database, Cloudflare, release-evidence workflow'ları; evidence schema/runtime; deployment/OTA guard testleri |
| Operasyon ve belgeler | Push DLQ/system broadcast araçları ve testleri; `docs/push-*.md`; Cloudflare/OTA/readiness/manual/final raporları |

### 2026-09-03 geçişinde değişen dosyalar

| Amaç | Dosyalar |
| --- | --- |
| Docker build context onarımı | `.dockerignore`, `infra/docker/.dockerignore`, `infra/docker/Dockerfile.tooling.dockerignore` |
| Docker guard sertleştirmesi | `utils/guards/check-docker-context.mjs` |
| Docker CI veritabanı kapısı | `.github/workflows/docker-validation.yml` |
| Production CORS placeholder doğrulaması | `.github/workflows/cloudflare-production.yml`, `utils/guards/__tests__/deployment-workflows.test.mjs` |
| Runtime-evidence v2 fixture'ları | `utils/release-evidence/runtime-evidence.test.mjs` |
| Backend complexity bütçesi | `utils/guards/check-source-health.mjs` |
| UTF-8/mojibake guard (yeni) | `utils/guards/check-text-encoding.mjs`, `utils/guards/__tests__/text-encoding.test.mjs` |
| Skor dürüstlüğü kapısı (yeni) | `utils/guards/check-release-scorecard.mjs`, `utils/guards/__tests__/release-scorecard.test.mjs`, `quality/release-scorecard.json` |
| Bağımlılık advisory düzeltmeleri | `package.json` (overrides), `package-lock.json`, `utils/guards/check-production-audit.mjs`, `docs/SECURITY_RISK_ACCEPTANCE.md` |
| Coverage için eklenen gerçek testler | `pushNotificationRepository.test.ts`, `useAuthSessionLifecycle.test.tsx`, `maps-geocoding/handler.test.ts`, `_shared/originSecurity.test.ts` |
| Yeni raporlar | `docs/audit/current-gap-matrix.md`, `docs/ui-ux/*.md` (4), `docs/architecture-and-kiss-report.md`, `docs/hardcode-and-dry-report.md`, `docs/docker-quality-environment.md`, `docs/push-delivery-runbook.md`, `docs/load-and-capacity-report.md` |

Bu geçişte hiçbir ekran, sekme, route, CTA, bildirim türü, izin, ürün tablosu
veya bucket değişmedi; feature-surface guard değişiklik öncesi ve sonrası aynı
adetleri raporlar.

## 5. Mevcut akış bazında güçlendirmeler ve nedenleri

| Mevcut akış | Güçlendirme | Neden / kullanıcı etkisi | Görünür ürün değişimi |
| --- | --- | --- | --- |
| Login/logout/account switch | Logout öncesi push token capability tombstone'u; owner-scoped cleanup ve bounded retry | Eski hesabın tokenının yeni hesaba taşınmasını ve veri sızıntısını önler | Yok |
| Push permission/kayıt | Startup/background yalnız mevcut izin durumunu gözler; sistem prompt'u yalnız kullanıcı-initiated akışta açılır | Beklenmedik izin istemini önler | Yok |
| Push background | Modül-içi seri dedupe, schedule başarılı olduktan sonra marker, bounded retry penceresi | Yarışta duplicate veya kalıcı bildirim kaybını azaltır | Yok |
| Push tap/deep link | Provider payload yerine recipient-owned RLS satırı rota otoritesidir | Sahte/değiştirilmiş payload'ın keyfi rota açmasını önler | Yok |
| Broadcast/teslim | Audience, dry-run, bounded batch, idempotency, redacted log, receipt/DLQ ve ops health/requeue | Yanlış toplu gönderim ve kör replay riskini azaltır | Yeni panel yok |
| Cloudflare gateway | Bounded body/read timeout, giriş ve origin cevap şeması, güvenli JSON yeniden serileştirme, `no-store`, request-owned JWKS fetch | Malformed/büyük cevap, kişisel cache ve request-isolation riskini azaltır | Yok |
| OTA/release | Environment/channel doğrulaması, EAS provider build identity kontrolü, certificate fail-closed kontrolü, otomatik canary rollback | Yanlış binary/runtime/SHA üzerine OTA ve başarısız rollout riskini azaltır | Yok |
| Docker doğrulama | Non-root/read-only/pinned deterministik mock, Worker/DB/fault/load profilleri ve cleanup | Üretim verisi/credential kullanmadan tekrarlanabilir backend kanıtı sağlar | Mobil runtime containerlaştırılmadı |

Push sözleşmesi ve dış kanıt sınırı
[push-current-contract.md](./push-current-contract.md),
[push-provider-and-token-lifecycle.md](./push-provider-and-token-lifecycle.md),
[push-outbox-retry-receipt-dlq.md](./push-outbox-retry-receipt-dlq.md),
[push-real-device-matrix.md](./push-real-device-matrix.md) ve
[push-incident-and-credential-rotation-runbook.md](./push-incident-and-credential-rotation-runbook.md)
içinde ayrıntılandırılmıştır.

## 6. Supabase değişiklikleri

- `20260831120000_harden_push_delivery_operations.sql`, push token cleanup
  capability'sini, terminal delivery audit/DLQ'yu, idempotent tekil requeue'yu ve
  scheduler health sözleşmesini forward-only olarak ekler.
- Eski uygulamalar için iki parametreli `upsert_user_push_token` ve dört
  parametreli broadcast RPC overload'ları korunmuştur. Yeni imzalar expand
  aşamasıdır; eski overload'ların kaldırılması ayrı adoption kanıtı gerektiren
  gelecekteki contract migration'ıdır.
- `20260831123000_fix_auth_login_guard_lint.sql`, mevcut auth login guard
  sözleşmesini migration geçmişini rewrite etmeden ileri yönlü düzeltir.
- İzole Supabase doğrulaması: tüm migration'larla zero-reset; DB lint
  `results: []`; 6 dosya/180 pgTAP testi geçti; ayrı veritabanına dump/restore
  sonrasında 22 public tablo doğrulandı; izole stack temiz kapandı.

Bu sonuç **yerel pre-commit kanıttır**. Hosted staging/prod migration apply,
provider Auth/Storage ayarları, production drift ve hosted PITR/restore değildir.

## 7. Cloudflare nerede, neden ve nasıl kullanılıyor

Cloudflare, Supabase'in yerine geçmez. Worker yalnız mevcut yüksek riskli HTTP
uçları için sabit edge sınırı, şema/body/method kontrolü, verified JWT,
rate-limit, origin HMAC, request korelasyonu ve güvenli hata sözleşmesi sağlar.
Auth, PostgreSQL/RLS, Realtime ve private Storage Supabase'te kalır; D1/KV/R2
ikinci source of truth yapılmaz; büyük medya Worker body proxy'sinden geçirilmez.

Yerel Worker sonucu: TypeScript/lint/types kontrolleri geçti; 3 dosya/34 test
geçti; preview ve production Wrangler dry-run'ları sentetik secret'larla başarılı
oldu. Bu, gerçek Cloudflare account, binding, custom domain, DNS/TLS, WAF,
provider rate-limit, origin enforcement, canary veya rollback kanıtı değildir.
Provider deploy yapılmadı ve production `workers.dev`/preview URL'leri kapalı
kalacak şekilde yapılandırıldı.

## 8. OTA/build sonucu ve OTA/native ayrımı

| Alan | Başlangıç | Çalışma ağacı | Kanıt durumu |
| --- | --- | --- | --- |
| Paket/uygulama sürümü | `1.0.101` | `1.0.102` | Kaynakta doğrulandı |
| Android versionCode | `106` | `107` | Kaynakta doğrulandı |
| Android versionName | `1.0.101` | `1.0.102` | Kaynakta doğrulandı |
| iOS buildNumber | `86` | `87` | Kaynakta doğrulandı |
| Runtime policy | `appVersion` | `appVersion` / `1.0.102` | Kaynakta doğrulandı |
| Android release channel | Sabitlik riski | EAS profile veya dar Gradle property allowlist'i; lokal default production | Test kaynağı mevcut; merged-manifest sonucu final koşuda tekrar gerekir |
| EAS build kanıtı | Serbest-form input | Provider `build:view` kimliği, source SHA, profile, app/runtime/artifact doğrulaması | Unit testleri geçti; aynı-SHA provider build yok |
| OTA code signing | Yapılandırılmamış | Geçerli tracked RSA certificate olmadan workflow fail-closed | EAS Free plan nedeniyle signed OTA bloke |

Native dependency/config, Gradle/manifest channel ve uygulama/runtime sürümü
değiştiği için bu candidate **`NATIVE_BUILD_REQUIRED`** sınıfındadır; production
OTA ile dağıtılamaz. `1.0.102`/107 Android AAB ve iOS 87 same-SHA build
kanıtlanmadan OTA-capable binary iddiası yoktur. Daha eski `1.0.101`/106 masaüstü
artifact'ı bu candidate'ın kanıtı değildir.

## 9. Çalıştırılan komutlar ve gerçek sonuçlar

2026-09-03 tarihinde, bu geçişteki tüm değişikliklerden **sonra** çalıştırıldı.

| Komut / doğrulama | Yerel sonuç | Kanıt sınırı |
| --- | --- | --- |
| `npm run typecheck` (app + tests) | PASS | — |
| `npm run lint` (7 guard dahil) | PASS | — |
| `npm run text-encoding:check` | PASS — 769 dosya, geçerli UTF-8, mojibake yok | Bu geçişte eklendi |
| `npm run feature-surface:check` | PASS — 12/12 guard testi; dondurulmuş adetler eşit | Aynı-SHA CI bekliyor |
| `npm run release-scorecard:check` | PASS — 7/7; 35 kategori, hepsi 9,80 altı | Bu geçişte eklendi |
| `npm run ota:classifier:test` | PASS — 44/44 | Provider publish/build değil |
| `npm run deployment-workflows:test` | PASS — 15/15 | Gerçek deploy değil |
| `npm run release-evidence:test` | PASS — 8/8 | v2 fixture'lar bu geçişte düzeltildi |
| `npm run ops:test` | PASS — 18/18 | Gerçek DB'ye karşı değil |
| `npm run test` | PASS — 167 dosya / 932 test | Cihaz E2E değil |
| `npm run security:verify` | PASS — 8 dosya / 117 test | Pen-test değil |
| `npm run dead-code:check` | PASS — bulgu yok | — |
| `npm run test:coverage` | PASS — branches %90,08; statements %94,53; lines %94,74; functions %94,10 | Eşik düşürülmedi; gerçek test eklendi |
| `npm run security:audit:prod` | PASS — 0 critical, 0 high, 4 moderate; 1 gerekçeli ve süreli acceptance | Pen-test değil |
| `npx expo-doctor` | PASS — 19/19 kontrol | Signed artifact değil |
| `npm run docker:config` | PASS — 8 profil, ignore/secret sözleşmesi | — |
| `npm run docker:test` | **PASS (exit 0)** — container profili 34 Worker testi; temiz Supabase reset + migration replay; db lint `results=[]`; 6 dosya/180 pgTAP; dump + izole restore parity 22 tablo / 70 routine / 50 RLS policy / 3 bucket | Hosted staging değil |
| `npm run docker:load:smoke` | PASS (exit 0) — 122.370 istek / 0 hata (%0,00); 24.474 iterasyon; 2.437,67/s; p90 1,08 ms; p95 1,64 ms; 5 akışta `no-store` doğrulandı | Deterministik mock upstream; **kapasite kanıtı değildir** |

### Bulunan ve düzeltilen yedi kusur

1. Üç `.dockerignore` dosyasındaki `+!App.tsx` diff artifact'ı (Docker hattı tamamen çalışmıyordu).
2. `docker-validation.yml` veritabanı yarısını hiç çalıştırmıyordu.
3. Production Worker deploy'u CORS allowlist'ini doğrulamıyordu.
4. Runtime-evidence fixture'ları kendi şemalarına göre bayattı.
5. Complexity bütçeleri backend kodunu kapsamıyordu.
6. İki HIGH production advisory açıktı; iki acceptance bayattı.
7. Branch coverage kendi eşiğinin altındaydı.

Hiçbiri devralınan bulgu listesinde yoktu; hepsi gate'ler çalıştırılarak bulundu.
Hiçbir eşik veya guard gevşetilmedi.

### Kritik not: Docker hattı bu geçişten önce hiç çalışmıyordu

Üç `.dockerignore` dosyasında `+!App.tsx` diff artifact'ı vardı. Docker bunu
literal pattern olarak okuduğu için `!App.tsx` re-include'ı hiç uygulanmadı ve
baştaki `**` deny dosyayı context dışında bıraktı. Her image build'i `COPY`
adımında `"/App.tsx": not found` ile düşüyordu. CI bunu yakalamadı; çünkü
workflow image'ı build eden profili çalıştırmıyordu.

Düzeltmeden **sonra** yukarıdaki `docker:test` sonucu alındı. Yani bu tablodaki
Supabase/pgTAP/restore satırları, bu geçişte onarılan bir hattın ilk gerçek
sonucudur.

Bu liste kirli çalışma ağacına aittir. Temiz candidate checkout'unda tüm zincir
yeniden koşmadan same-SHA attestation sayılmaz.


## 10. 35 alan skor tablosu

Puan uydurmamak için kesin `9.xx` notu verilmemiştir. `≤9.79`, repository işi
güçlü olsa bile aynı-SHA runtime/operasyon kanıtı eksik olduğundan master
promptun izin verdiği en yüksek kanıt tavanını; `≤8.99` önemli runtime veya
provider açığını gösterir. Hiçbir satırda `9.80` iddia edilmez.

| # | Alan | Başlangıç | Yapılan güçlendirme | Otomatik kanıt | Runtime/cihaz kanıtı | Kalan risk | Final | GO/NO-GO |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | UI/UX | Runtime kanıtsız | Yalnız mevcut loading/error/busy sözleşmeleri korundu | UI/copy/a11y guard'ları mevcut; final full run bekliyor | Fiziksel görsel regresyon yok | Ekran/font/device sapması | `≤9.79` | NO-GO |
| 2 | Çoklu cihaz | Kanıtsız | Yeni yüzey eklemeden device matrix tanımlandı | Statik/E2E sözleşmesi | Android+iOS fiziksel matris yok | OS/ölçek farkları | `≤8.99` | NO-GO |
| 3 | Performans | Kısmi yerel | Representative-flow k6 bütçesi ve mevcut hot-path guard'ları | K6 current-profile rerun bekliyor | Cold/warm/FPS/memory/battery cihaz ölçümü yok | Mobil ve mock performans regresyonu görünmeyebilir | `≤8.99` | NO-GO |
| 4 | Güvenlik/gizlilik | Provider/runtime açıkları | RLS/push/Worker fail-closed ve redaction sertleştirmesi | DB 180 pgTAP; Worker adversarial testleri | Hosted saldırı/secret/incident tatbikatı yok | Yanlış provider ayarı | `≤9.79` | NO-GO |
| 5 | Mimari | Statik sınırlar | Supabase SoT; seçici edge; compatibility overload'ları | Architecture/feature guard kaynakları | Dağıtılmış contract parity yok | Deploy drift | `≤9.79` | NO-GO |
| 6 | DRY | Statik | Push hook/navigation/cleanup sorumlulukları ayrıldı | Typecheck/hedef testleri | Runtime kanıt gerektirmez; same-SHA yok | Son diff review bekliyor | `≤9.79` | NO-GO |
| 7 | Hardcode/config | Placeholder/provider açıkları | HTTPS origin, channel, env ve schema allowlist'leri | Config/OTA testleri | Gerçek env/binding doğrulanmadı | Yanlış secret/channel | `≤9.79` | NO-GO |
| 8 | State | Yarış riski | Cleanup/background dedupe kuyrukları ve bounded retry | Hedefli concurrency testleri | Process-kill/account-switch cihaz kanıtı yok | OS lifecycle farkı | `≤9.79` | NO-GO |
| 9 | Network/API | Origin cevap riski | Timeout, bounded parse/schema, no-store, safe error | Worker 34 + 7 HTTP mock contract testi | Hosted 429/5xx/origin testi yok | Provider davranış farkı | `≤9.79` | NO-GO |
| 10 | Accessibility | Statik guard | Yeni UI açmadan mevcut accessibility sözleşmesi korundu | A11y guard tanımlı | VoiceOver/TalkBack/Dynamic Type yok | Fiziksel erişim engeli | `≤8.99` | NO-GO |
| 11 | Ölçek | Staging yok | Discovery/list/social/auth/edge için bounded k6 profile | Current-profile k6 sonucu bekliyor | İzole staging/DB plan/pool ölçümü yok | Gerçek trafik temsil edilmiyor | `≤8.99` | NO-GO |
| 12 | Dayanıklılık | Tatbikat eksik | 5 origin × latency/timeout/reset/bandwidth, push retry/DLQ, rollback workflow | DB restore geçti; expanded Docker fault rerun bekliyor | Hosted outage/restore/rollback yok | Operasyonel recovery bilinmiyor | `≤8.99` | NO-GO |
| 13 | Testler | Same-SHA paket yok | DB/Worker/push/OTA/Docker kapsamı eklendi | Yerel sonuçlar yukarıda; Docker expanded run pending | Mobil E2E ve remote CI yok | Entegrasyon açığı | `≤9.79` | NO-GO |
| 14 | Yerelleştirme | Kısmi | Mevcut Türkçe copy dışında dil/yüzey eklenmedi | Copy/source guard'ları | Uzun metin/locale cihaz testi yok | Taşma/encoding | `≤9.79` | NO-GO |
| 15 | Offline | Kaynak düzeyi | Tombstone, bounded retry ve owner cleanup | Concurrency/unit testleri | 24 saat/process-kill cihaz replay yok | Yerel storage/lifecycle | `≤8.99` | NO-GO |
| 16 | Push/deep link | Provider/cihaz kanıtsız | Token capability, safe tap, background dedupe, DLQ | Push 34 hedef test; DB pgTAP | Android+iOS tüm lifecycle yok | Teslim/receipt/token drift | `≤8.99` | NO-GO |
| 17 | Gözlemlenebilirlik | Provider kanıtsız | Redacted logs, request/health/DLQ korelasyonu | Logger/health testleri | Sentry/alert/provider event yok | Olay görünmezliği | `≤8.99` | NO-GO |
| 18 | CI/CD | Remote run yok | Fail-closed DB/Docker/OTA/rollback/evidence gates | Workflow unit/action kontrolleri kısmi | Protected env/onay/remote run yok | CI config/provider ayrışması | `≤9.79` | NO-GO |
| 19 | Dokümantasyon | Eski/dağınık | Runbook, push contract, readiness ve final rapor güncellendi | Link/path statik inceleme | Operatör tatbikatı yok | Runbook uygulanabilirliği | `≤9.79` | NO-GO |
| 20 | Domain mantığı | Kısmi | Eski RPC'lerle geriye uyum; delivery invariant'ları | 180 pgTAP içinde compatibility testleri | Hosted mutation concurrency yok | Eski istemci adoption | `≤9.79` | NO-GO |
| 21 | Bağımlılıklar | Pinned ama remote evidence yok | Worker type paketi/lockfile; image digest pinleri | Build-evidence unit 4/4; CI tanımı | Gerçek image provenance/SBOM artifact yok | Supply-chain drift | `≤9.79` | NO-GO |
| 22 | Batarya/kaynak | Ölçülmemiş | Retry süresi ve startup izin işi sınırlandı | Unit timeout/retry testleri | Fiziksel battery/thermal yok | Background tüketimi | `≤8.99` | NO-GO |
| 23 | Platform uyumu | Yeni binary gerekli | Profile-aware Android channel ve version parity | Config testleri | Signed AAB+iOS/native parity yok | Yanlış channel/entitlement | `≤8.99` | NO-GO |
| 24 | Store readiness | Kanıtsız | Sürüm kaynakları ve store runbook hazır | Statik config | Internal Track/TestFlight/privacy yok | Store red/ret | `≤8.99` | NO-GO |
| 25 | Operasyon olgunluğu | Owner/SLO yok | DLQ ops, incident, rollback ve evidence sözleşmesi | Ops unit testleri | Named owner, alert, RPO/RTO yok | Müdahale gecikmesi | `≤8.99` | NO-GO |
| 26 | Okunabilirlik | Kısmi | Push ve Worker sorumlulukları küçük modüllere ayrıldı | Typecheck/lint kısmi | Final review/same-SHA run yok | Karmaşıklık regresyonu | `≤9.79` | NO-GO |
| 27 | Genel olgunluk | NO-GO | Canary rollback, DB restore, push health kapıları | Yerel testler | Canlı sağlık/canary yok | P0 dış kanıt açıkları | `≤8.99` | NO-GO |
| 28 | Kod mimarisi | Statik | UI/application/data/platform ve edge sınırları korundu | Architecture/feature guard | Runtime dependency yönü kanıtı gerekmez; SHA yok | Son diff review | `≤9.79` | NO-GO |
| 29 | Kod kalitesi | Güçlü yerel taban | Strict TS, fail-closed errors, adversarial testler | Typecheck ve hedef testler geçti | Final full lint/release run bekliyor | Birleşik kapı sonucu yok | `≤9.79` | NO-GO |
| 30 | KISS | Statik | Yalnız Worker+Toxiproxy+k6; D1/KV/R2/Kafka vb. yok | Compose contract final rerun bekliyor; feature guard geçti | Provider topology doğrulanmadı | Gereksiz servis yok; deploy gap var | `≤9.79` | NO-GO |
| 31 | Kod hardcode | Dağınık risk | Timeout/retry/channel/env/route değerleri allowlist/config'e alındı | Config/contract testleri | Gerçek provider değerleri yok | Placeholder veya env drift | `≤9.79` | NO-GO |
| 32 | Yeniden kullanım | Kısmi | Ortak notification contract/repository ve logger kullanıldı | Typecheck/testler | Runtime farkı beklenmez; SHA yok | Son review | `≤9.79` | NO-GO |
| 33 | Kod performansı | Mobil ölçümsüz | Request/body bounds ve bounded retry; representative-flow load bütçesi | Worker geçti; expanded load pending | Render/query/upload profiling yok | Hot-path regresyonu | `≤8.99` | NO-GO |
| 34 | Test edilebilirlik | Mock açığı | Deterministik provider adaptörleri, fault injection, fake clock/network | Docker mock/evidence 11/11, Worker/push geçti; Compose expanded run pending | Gerçek provider çapraz kontrolü yok | Mock-gerçek sapması | `≤9.79` | NO-GO |
| 35 | Genişletilebilirlik | Contract riski | Expand/migrate/contract yaklaşımı ve versioned evidence | Legacy/yeni RPC pgTAP; schema testleri | Adoption/contract tatbikatı yok | Eski binary uyumluluğu | `≤9.79` | NO-GO |

## 11. Kalan manuel/dış işler

Kodla tamamlanamayan adımların exact komut, panel, beklenen sonuç, rollback,
owner ve evidence yolu [MANUAL_STEPS.md](./MANUAL_STEPS.md) içindedir. Release'i
kapatan başlıca dış kanıtlar:

1. Değişiklikleri temiz immutable candidate SHA'ya bağlama; aynı SHA'da Quality,
   Database, Docker, full-history secret scan ve release-evidence CI koşuları.
2. Ayrı hosted Supabase staging'de migration/drift/RLS/IDOR/Storage/Auth/Function
   doğrulaması; production push için ayrı onay.
3. Cloudflare account/token, preview custom domain, DNS/TLS/WAF/bindings/secrets,
   origin-HMAC direct-negative/replay, canary ve rollback.
4. EAS Free plan code-signing engelini çözme; tracked public certificate içeren
   yeni Android+iOS binary ve private-key ceremony kanıtı. Bu olmadan production
   signed OTA yoktur.
5. `1.0.102`/107 Android ve iOS 87 same-SHA signed build; Play Internal Track ve
   TestFlight install/smoke.
6. Android+iOS fiziksel cihaz push, offline, upload, auth/deep-link,
   accessibility, performance ve rollback matrisi.
7. Hosted backup/PITR + Storage restore, Sentry source-map/alert, store
   privacy/data-safety/UGC ve named owner/RPO/RTO/SLO kanıtları.

## 12. Risk register

| Risk | Etki | Kapanış koşulu |
| --- | --- | --- |
| Kirli/pre-commit çalışma ağacı | Yerel sonuçlar candidate'a bağlanamaz | Temiz commit + aynı-SHA CI/evidence manifest |
| EAS Free planında update code signing yok | Production OTA manifest/authenticity kapısı kapanmaz | Desteklenen plan/kurumsal karar + certificate/key ceremony + yeni iki-platform binary |
| Hosted staging yok | Migration/RLS/provider drift üretimde ortaya çıkabilir | İzole staging deploy ve negatif matris |
| Cloudflare provider deploy yok | DNS/WAF/binding/origin enforcement yalnız kaynak iddiası | Preview deploy, direct-negative, canary ve rollback artifact'ı |
| Fiziksel Android+iOS yok | Push/lifecycle/native erişilebilirlik bilinmiyor | Same-SHA real-device matrisi |
| Push provider credential/receipt yok | Token cleanup ve delivery health canlı doğrulanmadı | Credential parity, scheduler/receipt/invalid-token alarmı |
| Hosted restore yok | Gerçek RPO/RTO ve Storage recovery bilinmiyor | İzole hosted restore drill |
| Signed store artifact yok | OTA/store readiness iddia edilemez | Provider doğrulamalı build identity ve store install |
| Expanded Docker build bekliyor | Current-code fault/load/provenance sonucu yok | Engine kaynak yarışı bittikten sonra test/resilience/load + CI artifact rerun |

## 13. Rollback komutları

Komutlar bu çalışmada canlı ortamda çalıştırılmadı. Yalnız doğrulanmış incident
kimliği, exact ortam ve son-iyi kimliklerle kullanılmalıdır.

```powershell
# Yerel Docker doğrulama kaynaklarını temiz kapatır; volume silmez.
npm run docker:down

# Cloudflare — yalnız kaydedilmiş last-good version ile.
Set-Location infra/cloudflare/sorita-edge
npx wrangler rollback <LAST_GOOD_WORKER_VERSION_ID> --env production --message "<INCIDENT_ID>: restore last-good" --yes

# OTA aktif rollout'u durdurur/önceki update'e döner.
eas update:revert-update-rollout --group <BAD_GROUP_ID> --message "<INCIDENT_ID>: revert rollout" --json --non-interactive
eas update:rollback <BAD_GROUP_ID> --message "<INCIDENT_ID>: restore previous update" --platform all --json --non-interactive

# Kaynak — commit oluştuktan ve kapsam gözden geçirildikten sonra.
git revert <RELEASE_COMMIT_SHA>
```

DB migration geçmişi rewrite/reset edilmez. Sorunda trafik/işçi durdurulur ve
review edilmiş forward repair migration hazırlanır; production üzerinde
`supabase db reset --linked` çalıştırılmaz.

## 14. Nihai karar

Karar: **NO-GO**.

Kaynakta `1.0.102` / Android 107 / iOS 87 hazırlanmıştır. Repo tarafındaki tüm
kapılar bu çalışma ağacında geçmektedir ve bu geçişte beş gerçek kusur bulunup
düzeltilmiştir. Buna karşılık candidate SHA'ya bağlı signed Android+iOS build,
provider/staging kanıtı, gerçek cihaz push matrisi, hosted restore ve signed OTA
kanıtı **yoktur**. Eski masaüstü AAB bu candidate için kullanılamaz.

[quality/release-scorecard.json](../quality/release-scorecard.json) içindeki 35
kategorinin hiçbiri 9,80 iddia etmez ve bu, `check-release-scorecard.mjs`
tarafından makinece zorlanır: bir kategori ancak `RUNTIME_VERIFIED` seviyesinde
ve commit'e bağlı en az bir receipt ile hedefe ulaşabilir. Bu nedenle "9,80"
iddiası kanıt olmadan yazılamaz.

IMPLEMENTATION COMPLETE, RELEASE NO-GO UNTIL THE LISTED SAME-SHA RUNTIME/PROVIDER EVIDENCE IS VERIFIED.
