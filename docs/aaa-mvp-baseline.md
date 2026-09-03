# SoRita AAA-MVP doğrulanabilir başlangıç çizgisi

Tarih: 2026-08-30
Karar: `NO-GO`

> Bu dosya değişmez başlangıç kontrol noktasıdır: app `1.0.101`, Android 106,
> iOS 86. 2026-08-31 çalışma ağacının `1.0.102` / Android 107 / iOS 87 durumu
> ve yerel test sonuçları [aaa-mvp-final-report.md](./aaa-mvp-final-report.md)
> ile [release-readiness.md](./release-readiness.md) içindedir. Başlangıç değerleri
> final değerlerle geriye dönük olarak değiştirilmez.

## Bu belgenin anlamı

Bu başlangıç çizgisi, mevcut çalışma ağacında kanıtlanabilen durumu kaydeder. Sayısal kalite puanı üretmez ve kaynakta görülen bir yapılandırmayı çalışır dağıtım olarak kabul etmez.

Durum sözlüğü:

- `VERIFIED (STATIC)`: Kaynak, yapılandırma veya yerel statik guard doğrudan incelendi.
- `VERIFIED (LOCAL)`: Komut bu çalışma ağacında çalıştırıldı ve geçti; cihaz/canlı servis kanıtı değildir.
- `UNVERIFIED`: Sözleşme kaynakta var, fakat ilgili gerçek servis, binary veya cihaz kanıtı yok.
- `NO-GO`: Üretim veya OTA ilerlemesini engelleyen kanıt açığı var.

## Repo ve ürün tabanı

| Alan | Gözlenen taban | Durum |
| --- | --- | --- |
| Ürün yüzeyi | 10 kök rota, 4 sekme, 13 ekran girişi, 10 bildirim türü, 6 Edge Function sözleşmesi, 18 ürün tablosu, 3 storage kovası | `VERIFIED (LOCAL)` — `npm run feature-surface:check` geçti |
| Uygulama | React Native 0.83, Expo SDK 55, TypeScript strict, React Query v5 | `VERIFIED (STATIC)` — [package.json](../package.json), [tsconfig.json](../tsconfig.json) |
| Backend | Supabase Auth/Postgres/RLS/Realtime/Storage/Edge Functions | `VERIFIED (STATIC)` — istemci ve [supabase](../supabase) kaynakları |
| Binary sürümü | Uygulama `1.0.101`, Android `versionCode 106`, iOS `buildNumber 86`, runtime policy `appVersion` | `VERIFIED (STATIC)` — [app.config.ts](../app.config.ts) |
| Mimari sınır | UI → uygulama hook'ları → repository/data → platform | `VERIFIED (STATIC)` — [ARCHITECTURE.md](../ARCHITECTURE.md) ve kaynak yerleşimi |
| Çalışma ağacı | İnceleme anında değiştirilmiş ve izlenmeyen dosyalar içeriyor; sabitlenmiş yayın SHA kanıtı yok | `NO-GO` |

Ürün kapsamının ayrıntılı dondurması [existing-feature-contract.md](existing-feature-contract.md) içindedir.

## Güçlendirme tabanı

Kaynakta aşağıdaki mevcut özellik güçlendirmeleri gözlenir:

- Supabase refresh token yarışlarını önleyen süreç-geneli single-flight yenileme.
- Kullanıcı ve oturum nesline bağlı özel medya imzalı URL önbelleği; purge sırasında bekleyen ve çalışan istekleri reddetme/abort etme.
- Oturum kapatma veya kullanıcı değişiminde query cache, Realtime kanalları, özel medya, görünür veri, entity/screen cache, başlangıç cache'i ve kullanıcı outbox'ını merkezi temizleme.
- Yüksek riskli kimlik doğrulama eylemlerini `auth-gateway` üzerinden fail-closed yürütme; login guard verilerini hash'leme ve atomik kilitleme için migration kaynağı.
- Hesap silme için lease tabanlı, devam ettirilebilir saga migration/handler kaynağı.
- Seçili mevcut Edge Function çağrıları için `direct`/`gateway` cutover; otomatik doğrudan fallback yok.
- Kullanıcı kapsamlı kalıcı okuma cache'i ve sekiz mevcut işlem türüne sınırlı dayanıklı outbox.

Bunlar kaynak düzeyinde mevcuttur. Yeni migration dosyalarının gerçek veritabanına uygulandığı veya canlı gateway'in devreye alındığı anlamına gelmez.

## Kanıt matrisi

| Kapı | Mevcut kanıt | Durum | Yayın için gereken |
| --- | --- | --- | --- |
| Yeni özellik eklenmedi | Snapshot/guard aynı çalışma ağacında geçti | `VERIFIED (LOCAL)` | Aynı hedef SHA üzerinde tekrar çalıştırma |
| TypeScript/lint/unit testleri | Komutlar ve testler repoda tanımlı; bu belge tam yayın koşusunu imzalamaz | `UNVERIFIED` | `npm run check:release` tam, kesintisiz ve aynı SHA üzerinde |
| Supabase şema | Migration ve SQL güvenlik test kaynakları mevcut | `UNVERIFIED` | Temiz `supabase db reset --local`, lint, `supabase test db`, ayrıca hedef ortam migration kanıtı |
| Yedek/geri yükleme | CI'da izole `pg_dump`/`pg_restore` tatbikatı tanımlı | `UNVERIFIED` | Geçerli CI koşusu ve geri yükleme çıktısı |
| Cloudflare Worker | Bağımsız Worker, sözleşme/test/dry-run kaynakları var | `NO-GO` | Placeholder'lar değiştirilmiş, secrets/bindings doğrulanmış, test/dry-run ve gerçek deploy/canary kanıtı |
| Android binary | EAS workflow koşullu olarak tanımlı | `UNVERIFIED` | Hedef SHA için başarılı preview build ve gerçek cihaz kabul testi |
| iOS binary | Repo içinde iOS native klasörü yok; prebuild/EAS gerekir | `UNVERIFIED` | Hedef SHA için başarılı preview build ve gerçek cihaz kabul testi |
| Push/Realtime | FCM ve Supabase Realtime controller/repository kaynakları var | `UNVERIFIED` | İki gerçek kullanıcı ve foreground/background/killed-state cihaz kanıtı |
| Deep link/auth callback | Parser ve test kaynakları ile Maestro senaryoları var | `UNVERIFIED` | E-posta linki üzerinden iOS/Android gerçek ortam testi |
| Kamera/fotoğraf/video/konum | İzinler ve özellik kodu mevcut | `UNVERIFIED` | İzin red/kabul, düşük depolama/bellek ve gerçek cihaz medya/konum matrisi |
| Çevrimdışı/yarış durumları | Cache/outbox/single-flight kaynakları ve birim testleri var | `UNVERIFIED` | Uçak modu, bağlantı salınımı, uygulama öldürme, çoklu kullanıcı ve eşzamanlı işlem cihaz testi |
| OTA preview | SHA, binary kanıtı, classifier ve release gate isteyen workflow mevcut | `UNVERIFIED` | Başarılı preview update grubu ve uyumlu binary üzerinde smoke test |
| Production OTA | Önce preview aynı SHA ve başlangıçta %5 rollout isteyen workflow mevcut | `NO-GO` | Onaylı preview kanıtı, gözlem penceresi, kademeli rollout ve doğrulanmış rollback |
| Gözlemlenebilirlik | Yapılandırılabilir Sentry ve yapılandırılmış log kodu var | `UNVERIFIED` | Gerçek DSN/ortam, olay alımı, alarm ve PII redaksiyon kanıtı |

CI ve OTA tanımlarının varlığı bir GitHub Actions/EAS çalışmasının geçtiğini kanıtlamaz. İlgili statik sözleşmeler [.github/workflows/ci.yml](../.github/workflows/ci.yml), [eas-update-preview.yml](../.github/workflows/eas-update-preview.yml) ve [eas-update-production.yml](../.github/workflows/eas-update-production.yml) içindedir.

## Kritik akış tabanı

[critical-flows.json](../e2e/critical-flows.json) 30 mevcut kritik akış için kaynak/test eşlemesi tutar. Bu dosya bir cihaz test sonucu değildir. Repoda anonim cold-start/guest auth ve UI katalog odaklı Maestro senaryoları bulunur; tam kimlik doğrulanmış, çok kullanıcılı ve iki platformlu uçtan uca kanıt yoktur.

Özellikle aşağıdaki akışlar kanıt tamamlanana kadar `NO-GO` kapsamındadır:

- Doğrulanmış kullanıcıyla cold start ve kullanıcı değiştirme/çıkış yarışı.
- Gerçek e-posta parola sıfırlama deep link'i.
- Push bildirimin foreground, background ve killed-state yönlendirmesi.
- Fotoğraf/video yükleme, yeniden deneme, sıralama/silme ve özel medya erişimi.
- Konum izni, harita ve fiziksel cihaz davranışı.
- Uçak modu, uygulama öldürme sonrası outbox replay ve çoklu kullanıcı veri izolasyonu.
- Hesap silme sagasının gerçek görev/lease/reconcile davranışı.

## Veritabanı ve edge uyarıları

[20260830143000_harden_auth_identifiers_and_mass_assignment.sql](../supabase/migrations/20260830143000_harden_auth_identifiers_and_mass_assignment.sql) ile [20260830150000_harden_account_deletion_saga.sql](../supabase/migrations/20260830150000_harden_account_deletion_saga.sql) kaynakta bulunur. Yerel reset/test ve hedef ortama uygulama kanıtı bu belgede yoktur: `UNVERIFIED`.

[Cloudflare Worker README](../infra/cloudflare/sorita-edge/README.md) açıkça deploy yapılmadığını söyler. [wrangler.jsonc](../infra/cloudflare/sorita-edge/wrangler.jsonc) `.invalid` origin'ler, `replace-*-project-ref` URL'leri ve ayrılmış placeholder namespace kimlikleri içerir. Bu değerlerle gateway production'a çıkarılamaz: `NO-GO`.

[supabase/seed.sql](../supabase/seed.sql) bilerek boştur; üretim benzeri kullanıcı/içerik uydurulmamıştır.

## AAA-MVP tamamlanma ölçütü

Üretim kararı ancak aşağıdakilerin tümü aynı hedef SHA ve onaylı ortamlar için kanıtlandığında `GO` olabilir:

1. Özellik yüzeyi, typecheck, lint, birim/integrasyon, güvenlik, performans, provenance ve coverage kapılarının tam geçişi.
2. Temiz yerel Supabase reset/lint/SQL testleri ve yedek geri yükleme tatbikatı.
3. Migration'ların hedef ortamda doğrulanması; RLS, service-role sınırı, rate limit, nonce, push delivery ve hesap silme sagası kabul testleri.
4. Cloudflare placeholder/secrets/bindings/origin-HMAC hazırlığı veya onaylı `direct` mod kararı; seçilen modda canary ve gözlemlenebilirlik.
5. Android ve iOS preview binary'lerinde kritik akışların gerçek cihaz matrisi.
6. Aynı SHA için OTA sınıflandırma, preview smoke, kademeli production rollout ve rollback tatbikatı.
7. Açık yüksek/ kritik hata, veri kaybı veya kullanıcılar arası veri sızıntısı bulgusunun olmaması.

Bu kanıtlar mevcut olmadığından nihai durum `NO-GO`dur; bu bir kalite puanı değil, kanıt kapısı kararıdır.
