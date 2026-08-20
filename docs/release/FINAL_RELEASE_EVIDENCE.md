# SoRita release kanıtı

Tarih: 2026-08-17
Karar: **NO-GO — harici ve manuel kapılar tamamlanmadı**

Bu belge yalnızca bu çalışma alanında gerçekten üretilen kanıtı kaydeder. Yetkili staging,
production, iOS, fiziksel cihaz, mağaza veya sağlayıcı kontrolü yapılmadan ilgili alan PASS ya da
9,8 olarak değerlendirilmez.

## Uygulanan ana iyileştirmeler

- Uygulama bağlantıları, auth callback ve paylaşım akışları yalnızca `sorita://` şemasına taşındı;
  web origin ve localhost CORS varsayılanları kaldırıldı.
- Geocoding istemcisi doğrudan Google servis anahtarı kullanan fallback/merge/score katmanından
  arındırıldı; tüm arama ve reverse-geocoding çağrıları kimlik doğrulamalı Edge Function üzerinden
  geçiyor. Static Maps anahtarı ayrı ve yalnızca görsel önizleme için kullanılıyor.
- Profil, liste, mekân ve yorum UGC alanlarına sunucu tarafı objectionable-content trigger'ları
  eklendi; değiştirilmiş istemcinin moderasyon kontrolünü atlaması engellendi.
- Request nonce ve Edge rate-limit tablolarındaki her-istekte global temizlik kaldırıldı;
  deterministik örneklemeli bakım trigger'larına taşındı. Hot complete-card konum sorgusuna
  eşleşen expression index eklendi.
- Üretim bağımlılıklarındaki yamalanabilir `js-yaml`, `nanoid` ve `postcss` advisories giderildi.
  Yaması bulunmayan iki `image-size` build-time advisory için asset magic/uzantı taraması,
  Metro-only zincir doğrulaması ve süreli risk kabul kapısı eklendi.
- Android/iOS platformuna göre 48 dp / 44 pt merkezi dokunma hedefleri, async repeat koruması,
  reddedilen Promise sonrası doğru busy state ve erişilebilirlik state birleştirmesi sağlandı.
- Çıkış akışındaki bağımsız modül yükleme ve cleanup çağrıları paralelleştirildi. Mini-map ve
  navigation kodundaki tekrarlı/gereksiz katmanlar sadeleştirildi.
- Güncel feed, explore, profile-content ve notifications RPC'lerini kullanan, en fazla 10.000 VU,
  hata <%0,5, p95 <600 ms ve p99 <1.200 ms eşikli k6 profili eklendi.

## Yerel otomatik kanıt

| Kapı | Sonuç |
|---|---|
| Expo uyumluluk / Doctor | PASS, 19/19 |
| ESLint | PASS, 0 warning |
| Architecture / source-health | PASS, 374 dosya; cycle ve bütçe ihlali yok |
| UI copy / token / pressable accessibility | PASS |
| TypeScript app + tests | PASS |
| Dead code / dependency kullanımı | PASS |
| Kritik akış manifesti | PASS, 30/30 executable kanıta eşlendi |
| Unit / integration | PASS, 140 dosya / 731 test |
| Security suite | PASS, 6 dosya / 74 test |
| Coverage | statements %94,64; branches %90,01; functions %93,91; lines %94,85 |
| Performance suite | PASS, 7 dosya / 24 test |
| Metro asset güvenliği | PASS, 96 repository image asset |
| Production audit policy | PASS: 0 critical, 0 moderate; iki upstream advisory nedeniyle 10 high zincir kaydı süreli kabulde |
| Raw `npm audit --omit=dev` | FAIL: 10 high; yalnızca iki yamalanmamış transitive Metro/`image-size` advisory zinciri |
| License policy | PASS, 737 locked production package |
| Registry signatures / attestations | PASS, 967 imza; 212 attestation |
| Hermes Android bundle | PASS, 8,83 MiB / 12 MiB bütçe |
| Android baseline profile merge | PASS |
| Android standalone APK | PASS, emulator install/launch; 124.576.685 byte universal APK |
| Android görsel smoke | PASS: orta ekran, 360×640 dp, klavye, safe area, legal modal, UI accessibility tree |
| k6 script parse | PASS; gerçek yük çalıştırılmadı |

## 42 kategorinin kanıta dayalı puanı

Puanlar hedef değil, bugünkü kanıt seviyesidir.

| # | Kategori | Puan | Kanıt / açık kapı |
|---:|---|---:|---|
| 1 | UI/UX | 9,2 | Android auth/legal görsel turu geçti; tüm authenticated ekran matrisi yok |
| 2 | Cihaz uyumu | 8,5 | Orta ve 360×640 Android geçti; iOS/fiziksel matris yok |
| 3 | Performans | 9,0 | Bundle, profile ve unit bütçeleri geçti; native profiler yok |
| 4 | Güvenlik/gizlilik | 9,2 | Server moderation, Edge-only geocoding, 74 test; live pentest/RLS yok |
| 5 | Mimari | 9,6 | Boundary ve cycle kapıları yeşil |
| 6 | DRY | 9,5 | Ortak UI/network katmanları ve dead-code kapısı yeşil |
| 7 | Hardcode/config | 9,7 | UI copy/token guard yeşil; yerel `.env` legacy anahtarları operatör temizliği ister |
| 8 | State yönetimi | 9,5 | Query/outbox/optimistic testleri güçlü |
| 9 | Network/API | 9,5 | Edge trust boundary, retry ve read-model sözleşmeleri testli |
| 10 | Erişilebilirlik | 9,0 | Roller/etiketler/hedefler ve Android ağaç kanıtı; TalkBack/VoiceOver turu yok |
| 11 | Ölçeklenebilirlik | 8,7 | Index ve 10.000 VU profili hazır; staging k6/EXPLAIN yok |
| 12 | Hata yönetimi | 9,6 | Fail-closed, retry, outbox ve async recovery testleri |
| 13 | Testler | 9,6 | 731 test ve dört coverage metriği >=%90 |
| 14 | Türkçe/i18n | 9,7 | Merkezi katalog ve raw-copy guard |
| 15 | Offline | 9,0 | Kalıcı outbox mevcut; cihaz airplane-mode matrisi yok |
| 16 | Push/deep link | 8,5 | Mobil scheme ve controller testleri; terminated cihaz turu yok |
| 17 | Analytics | 9,0 | PII-siz typed Sentry metrikleri; production dashboard yok |
| 18 | CI/CD | 9,0 | Kapılar repository'de; bu değişiklikler için gerçek GitHub run yok |
| 19 | Dokümantasyon | 9,5 | SLO/threat/retention/release/risk kabul belgeleri güncel |
| 20 | Sosyal mantık | 9,2 | Optimistic/concurrency testleri; live çok-kullanıcılı RLS kanıtı yok |
| 21 | Dependency sağlığı | 8,7 | Yamalanabilir bulgular giderildi; raw audit upstream nedeniyle 10 high |
| 22 | Batarya/kaynak | 8,2 | Bounded work/freeze mevcut; fiziksel profiler yok |
| 23 | Platform uyumu | 8,3 | Android standalone doğrulandı; iOS build/smoke yok |
| 24 | Store hazırlığı | 7,8 | Universal standalone var; production-signed AAB/TestFlight/Internal Track yok |
| 25 | Yatırımcı teknik olgunluğu | 9,1 | Kanıt ve risk ayrımı güçlü; production paketi tamamlanmadı |
| 26 | Okunabilirlik | 9,4 | Lint/source-health yeşil; bazı büyük dosyalar kontrollü istisna |
| 27 | Profesyonellik | 9,1 | Release/security disiplini var; rehearsal yok |
| 28 | Kod mimarisi | 9,6 | Feature/platform/data sınırları otomatik korunuyor |
| 29 | Kod kalitesi | 9,5 | Lint/type/dead-code/test/coverage yeşil |
| 30 | KISS | 9,2 | Geocoding 400+ satırdan dar Edge istemcisine indi; büyük hook borcu sürüyor |
| 31 | Secret yönetişimi | 8,5 | İstemci/server anahtar sınırı iyileşti; key restriction/history rotation kanıtı yok |
| 32 | Yeniden kullanım | 9,5 | Ortak primitive, modal, map ve query katmanları |
| 33 | Kod performansı | 9,2 | Waterfall azaltımı, cache ve bundle bütçesi; native trace yok |
| 34 | Test edilebilirlik | 9,6 | Repository/controller seam'leri ve 731 test |
| 35 | Genişletilebilirlik | 9,4 | Additive migration ve feature sınırları |
| 36 | Veri bütünlüğü | 9,0 | Trigger/index/idempotency hazır; yeni migration'lar yerelde uygulanmadı |
| 37 | Medya ekonomisi | 9,0 | Batch/cache/dedupe/limitler; gerçek CDN maliyeti yok |
| 38 | Trust & safety | 9,4 | Server-side UGC enforcement ve report pipeline; operasyon SLA kanıtı yok |
| 39 | SLO/observability | 8,8 | Typed ölçümler ve SLO hazır; alert/burn-rate dashboard yok |
| 40 | Supply chain | 8,9 | İmza/lisans/asset kapıları yeşil; upstream `image-size` yaması yok |
| 41 | Backup/data lifecycle | 7,8 | Retention/CI tasarımı var; restore drill çalıştırılmadı |
| 42 | Profesyonel paylaşım | 8,8 | Mobil deep link üretimi testli; cross-app cihaz matrisi yok |

Ortalama kanıt puanı: **9,0/10**. Bu değer 9,8 release onayı değildir.

## Açık harici kapılar

- Yeni migration'ları temiz Supabase reset, DB lint ve pgTAP ile çalıştır; live drift ve temsili
  `EXPLAIN (ANALYZE, BUFFERS)` sonuçlarını sakla.
- 10.000 VU profilini izole staging verisi ve en az 20 test kimliğiyle çalıştır.
- iOS build ile fiziksel iOS/Android cihazlarda authenticated 30 akış, Dynamic Type %200,
  TalkBack/VoiceOver, offline, push/deep-link, kamera/medya ve performans matrisini tamamla.
- Google anahtar API/bundle/package restriction'larını ve credential rotation/history taramasını
  yetkili konsollarda doğrula.
- Production Sentry dashboard/alert/retention, signed AAB/TestFlight/Internal Track, store privacy,
  staged rollout ve rollback rehearsal kapılarını tamamla.

## Production kararı

Repository ve Android emulator kapıları güçlüdür; production release yine de **NO-GO**'dur.
Özellikle yeni DB migration'ları, gerçek 10.000 VU yükü, iOS/fiziksel cihazlar, production
observability ve store imzalı dağıtım kanıtı olmadan 9,8+ veya GO iddiası yapılamaz.
