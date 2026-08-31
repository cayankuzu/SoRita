# SoRita AAA-MVP — Nihai Yerel Doğrulama ve Release Kararı

Tarih: 2026-08-31
Kapsam: yalnız mevcut ürün yüzeyini güçlendirme; yerel Docker kullanılmadı.

## 1. Gerçek durum özeti

Mevcut SoRita ürün yüzeyi korunarak kimlik doğrulama, hesap silme, medya yükleme,
özel kapak erişimi, liste kaydetme, istemci önbellekleri, Supabase Edge Function
güvenliği, seçici Cloudflare geçidi, OTA kuralları, release kanıtı ve operasyon
runbook'ları güçlendirildi.

Yerel kod, test, coverage, Worker ve Android release derleme kontrolleri başarılıdır.
Ancak bu çalışma ağdan bağımsız/yerel kanıttır. Canlı Supabase, Cloudflare, EAS,
Sentry ve mağaza sağlayıcı kanıtları ile aynı commit SHA'ya bağlı imzalı release
kanıtı yoktur. Bu nedenle nihai karar **NO-GO**'dur.

## 2. Başlangıç ve son ürün yüzeyi karşılaştırması

| Kontrol | Başlangıç sözleşmesi | Sonuç |
| --- | --- | --- |
| Kök rota | 10 | 10 — korundu |
| Alt sekme | 4 | 4 — korundu |
| Ekran | 13 | 13 — korundu |
| Bildirim türü | 10 | 10 — korundu |
| Edge Function sözleşmesi | 6 | 6 — korundu |
| Ürün tablosu | 18 | 18 — korundu |
| Storage bucket | 3 | 3 — korundu |
| Ayarlar grubu | 3 | 3 — korundu |
| Ayarlar CTA | 19 | 19 — korundu |

## 3. Yeni ekran/sekme/rota/CTA/bildirim denetimi

\`feature-surface:check\` ile ürün yüzeyi envanteri ve negatif testler çalıştırıldı.
Yeni ekran, sekme, rota, ayar CTA'sı veya bildirim türü eklenmedi. Cihaz test komutu,
release yapısında kasıtlı olarak bulunmayan geliştirme UI Catalog akışından ayrıldı:
\`e2e:device:guest\` release-uyumlu misafir akışı; \`e2e:device:dev-catalog\` yalnız
geliştirme yapısı için açıkça adlandırılmış akıştır. Bu bir ürün yüzeyi değişikliği değildir.

## 4. Değişen dosya grupları

| Grup | Ana kapsam |
| --- | --- |
| Mobil istemci | auth yaşam döngüsü ve kullanıcıya bağlı veri temizliği, liste kalıcılığı/ilerleme, medya hata ve imzalı URL protokolü, runtime yapılandırması |
| Supabase | Edge Function request/origin/rate-limit korumaları; auth-gateway, delete-user, media-assets, maps ve moderation sertleştirmesi |
| Veritabanı | auth identifier/mass-assignment, silme saga, özel kapak yetkisi, moderation, Cloudflare origin imzası, medya session-state migration ve SQL güvenlik testleri |
| Cloudflare | seçici Edge gateway Worker, route matrisi, tehdit modeli, preview/production workflow'ları |
| OTA/release | runtime sınıflandırıcısı, EAS workflow'ları, evidence manifesti, rollback/backup/SLO runbook'ları |
| Kalite | feature-surface, source health, security, operasyon ve coverage test/guard'ları |
| Android sürümleme | \`app.config.ts\`, \`android/app/build.gradle\`, manifest/kaynak sürüm metinleri ve paket metadata'sı |

## 5. Akış sertleştirmesi

- Kimlik doğrulama girişleri normalize edildi; session yenileme ve kullanıcı değişiminde
  kullanıcıya bağlı önbellek temizliği test edildi.
- Hesap silme saga'sında idempotency, lease yenileme/heartbeat ve tekrar deneme yolları
  kapsandı.
- Liste kaydetme/kapak akışlarında sahiplik, kalıcılık ilerlemesi ve özel medya erişimi
  fail-closed hale getirildi.
- Medya upload session'ları explicit state guard'ları, hata yolları ve süpürme
  operasyonuyla güçlendirildi.
- Moderation ve harita Edge uçları istek doğrulama, rate limit ve origin güvenliğiyle
  sıkılaştırıldı.

## 6. Supabase değişiklikleri ve sınırı

Sekiz migration ve ilgili SQL testleri eklendi; özellikle \`20260830173000_durable_media_upload_sessions_and_state_guards.sql\`
medya yükleme session'larının dayanıklılığı ve geçersiz durum geçişlerinin engellenmesi
içindir. SQL/RLS/IDOR test dosyaları statik olarak denetlendi, fakat yerel Docker
kullanılmadığı için gerçek Supabase veritabanına migration veya pgtap çalıştırılmadı.
Canlı veritabanı sonucu olmadan RLS, mevcut veri uyumluluğu ve storage policy başarısı
iddia edilmez.

## 7. Cloudflare yaklaşımı

Cloudflare Worker yalnız seçici geçit olarak tasarlandı: route matrisi ve origin imzası
ile doğrudan menşe erişimini kapatmaya, JWT/rate-limit/boyut kontrollerini fail-closed
uygulamaya odaklanır. Bu yaklaşım yeni mobil ürün yüzeyi oluşturmaz. Worker'ın yerel
tip, lint ve birim testleri geçmiştir; gerçek preview/production binding, secret,
hostname, origin HMAC ve trafik davranışı henüz kanıtlanmamıştır.

## 8. OTA ve native sürümleme

| Alan | Önce | Sonra |
| --- | --- | --- |
| Paket/uygulama sürümü | 1.0.100 | 1.0.101 |
| Android versionCode | 105 | 106 |
| Android versionName | 1.0.100 | 1.0.101 |
| iOS buildNumber (Expo config) | 85 | 86 |
| OTA runtime policy | appVersion | appVersion / 1.0.101 native runtime |

Runtime politikası native uygulama sürümüne bağlıdır; bu değişiklikten sonra eski native
binary'lere yeni native bağımlılık içeren OTA gönderilemez. OTA sınıflandırıcı testleri
geçti, fakat EAS Update yayınlama/rollback cihaz kanıtı tamamlanmadı.

## 9. Çalıştırılan komutlar ve sonuçlar

| Komut / doğrulama | Sonuç |
| --- | --- |
| \`npm run check:release\` | **PASS** — Expo Doctor 19/19, statik kalite, typecheck, security, unit ve coverage zinciri tamamlandı |
| Test toplamı | **PASS** — 163 dosya, 882 test |
| Global coverage | **PASS** — statements %94.66, branches %90.01, functions %94.24, lines %94.87 |
| \`infra/cloudflare/sorita-edge npm run check\` | **PASS** — types, TypeScript, lint, 3 dosya/30 Worker testi |
| \`npm run e2e:device:guest -- --udid emulator-5556\` | **PASS** — misafir/sign-in/reset/register başlangıç akışları |
| \`npm run e2e:device:small\` | **PASS** — küçük ekran ve klavye akışları |
| \`android\\gradlew.bat bundleRelease\` | **PASS** — lokal Sentry source-map otomatik yüklemesi kapalıyken artifact üretildi |
| \`android\\gradlew.bat assembleRelease\` | **PASS** — release APK üretildi |
| Gradle Hermes bundle budget | **PASS** — 5.61 MiB / 12 MiB |
| \`jarsigner -verify\` | **PASS with warnings** — imza doğrulandı; upload anahtarının self-signed zinciri, timestamp yokluğu ve JAR okuyucu uyarıları ayrıca kaydedildi |
| Expo standalone \`bundle:android:check\` | **FAIL / NO-GO kanıtı** — Metro export sonrası yerel EPERM ile Hermes bytecode dosyası açılamadı |

İlk Gradle bundle denemesinde Sentry source-map upload için sağlayıcı 401 döndü. AAB/APK
oluşturmak için yalnız otomatik source-map upload geçici olarak devre dışı bırakıldı; uygulamanın
Sentry yapılandırması değiştirilmedi. Bu nedenle source-map yükleme ayrıca manuel olarak aynı
kaynak/commit ile doğrulanmalıdır.

\`jarsigner -verify\` komutu \`jar verified\` ile çıktı verdi. Aynı komut upload sertifikasının
self-signed olduğu, timestamp taşımadığı ve bundle içeriğinin JarFile/JarInputStream okuma
davranışıyla ilgili uyarılar da verdi. Bunlar yerel imzanın geçerliliğini tersine çevirmedi,
ama Play Console/App Signing kabul kanıtının yerini tutmaz.

## 10. 35 alanlı kanıt, puan ve karar tablosu

Puan yalnız kanıt durumunu gösterir; toplam puan yayın onayı değildir.

| # | Kanıt alanı | Durum | Puan | Kanıt veya engel |
| ---: | --- | --- | ---: | --- |
| 1 | Kaynak feature freeze | PASS | 1/1 | Mevcut sözleşme korundu |
| 2 | Rota/sekme/ekran envanteri | PASS | 1/1 | 10 / 4 / 13 sabit |
| 3 | CTA/bildirim yüzeyi | PASS | 1/1 | 19 CTA, 10 bildirim sabit |
| 4 | TypeScript | PASS | 1/1 | Uygulama ve test typecheck |
| 5 | Lint/mimari | PASS | 1/1 | Lint, boundary, health, UI/a11y guard'ları |
| 6 | Birim/entegrasyon testleri | PASS | 1/1 | 882 test |
| 7 | Coverage eşiği | PASS | 1/1 | Branch %90.01 dahil |
| 8 | Güvenlik odaklı testler | PASS | 1/1 | 8 dosya / 109 hedef test |
| 9 | Production dependency audit | PASS | 1/1 | Kritik/yüksek/orta bulgu yok |
| 10 | Production lisans kontrolü | PASS | 1/1 | 740 kilitli paket |
| 11 | Dependency provenance | PASS | 1/1 | 970 imza, 218 attestation |
| 12 | Expo Doctor | PASS | 1/1 | 19/19 |
| 13 | OTA sınıflandırıcı | PASS | 1/1 | 33 test |
| 14 | Deployment workflow testleri | PASS | 1/1 | 10 test |
| 15 | Release evidence mantığı | PASS | 1/1 | 4 test; gerçek evidence henüz yok |
| 16 | Operasyon script testleri | PASS | 1/1 | 15 test |
| 17 | DB migration/SQL statik denetim | PASS | 1/1 | Migration ve SQL testleri gözden geçirildi |
| 18 | DB migration runtime | UNVERIFIED | 0/1 | Docker/uzak DB çalıştırılmadı |
| 19 | RLS/IDOR runtime | UNVERIFIED | 0/1 | Gerçek Supabase rol/matris kanıtı yok |
| 20 | Media session state guard | PASS | 1/1 | Handler ve coverage testleri |
| 21 | Media sweep operasyonu | PASS | 1/1 | Script/workflow testleri |
| 22 | Backup/PITR restore | UNVERIFIED | 0/1 | Sağlayıcı restore tatbikatı yok |
| 23 | Supabase auth/secret/provider | UNVERIFIED | 0/1 | Canlı provider/secret kanıtı yok |
| 24 | Cloudflare Worker yerel kontrol | PASS | 1/1 | 30 Worker testi, type/lint |
| 25 | Cloudflare preview/production | UNVERIFIED | 0/1 | Deploy/binding/hostname kanıtı yok |
| 26 | Cloudflare origin HMAC canlı | UNVERIFIED | 0/1 | Secret ve gerçek istek kanıtı yok |
| 27 | EAS OTA preview/yayın | UNVERIFIED | 0/1 | Sağlayıcıya yayın yapılmadı |
| 28 | Sentry source-map upload | UNVERIFIED | 0/1 | İlk denemede 401; artifact üretiminde upload kapatıldı |
| 29 | Native Android AAB | PASS | 1/1 | bundleRelease, hash ve jarsigner doğrulandı |
| 30 | Mağaza/app-signing kabulü | UNVERIFIED | 0/1 | Play/App Signing sağlayıcı sonucu yok |
| 31 | Cihaz misafir/küçük ekran | PASS | 1/1 | Ayrı temiz emulator-5556 |
| 32 | Tam auth/ağ cihaz matrisi | UNVERIFIED | 0/1 | Sağlayıcı/gerçek kullanıcı akışları yok |
| 33 | Expo standalone bundle kontrolü | FAIL | 0/1 | Yerel Metro/Hermes EPERM |
| 34 | Aynı commit SHA release kanıtı | UNVERIFIED | 0/1 | Çalışma dizini commit edilmemiş |
| 35 | Nihai release kararı | NO-GO | 0/1 | Aşağıdaki zorunlu kanıtlar eksik |

Yerel kanıt skoru: **22/35**. Eksik alanlardan biri bile runtime/sağlayıcı güvenlik veya
yayın yolunu etkilediğinde bu skor GO anlamına gelmez.

## 11. Zorunlu manuel/CI işlemleri

1. Bu değişiklikleri tek, gözden geçirilmiş bir commit'e alın; release evidence manifestini o
   SHA, AAB SHA-256 ve sürüm bilgileriyle yeniden üretin.
2. Docker etkin CI ortamında \`.github/workflows/database-validation.yml\` ile migration,
   pgtap/RLS/IDOR ve seed/upgrade yolunu çalıştırın.
3. Cloudflare preview ardından production deploy'unu, binding/secret/route/origin-HMAC ve
   fail-closed negatif istek matrisiyle doğrulayın.
4. Geçerli Sentry kimlik bilgisi ile bu native kaynak için source-map upload yapın ve event
   symbolication kanıtını saklayın.
5. EAS preview/production OTA'yı doğru runtime \`1.0.101\` üzerinde yayınlayın; fiziksel
   Android ve iOS cihazlarda cold start, rollback, offline/cache, auth, liste ve upload akışlarını
   test edin.
6. AAB'yi Play Console/App Signing hattına yükleyip kabul, signing certificate ve bundle
   metadata sonucunu aynı commit SHA'ya bağlayın.
7. Expo'nun standalone Android export/Hermes \`EPERM\` sorununu temiz CI/uyumlu Node ortamında
   bytecode kapatmadan yeniden çalıştırın.

## 12. Risk kaydı

| Risk | Etki | Azaltım / kapanış koşulu |
| --- | --- | --- |
| Yerel Expo Metro/Hermes EPERM | Bundle export kanıtı eksik | Temiz CI'da bytecode açık tekrar |
| Sentry 401 | Release eventleri symbolicate olmayabilir | Yetkili source-map upload ve test event |
| Canlı DB uygulanmayan migration | Veri/RLS regresyonu | Docker CI + staging restore/migration |
| Cloudflare binding/secret belirsizliği | Origin erişimi veya API kesintisi | Preview/prod smoke + negatif test |
| Commit dışı çalışma dizini | Artifact kaynakla bağlanamaz | Tek SHA, immutable evidence manifest |
| Play/App Signing kanıtı yok | AAB mağazada kabul edilmeyebilir; yerel jarsigner uyarıları vardır | Console upload/sertifika sonucu |
| R8 play-services-auth uyarısı | Düşük; bytecode metadata uyarısı | Sonraki bağımlılık güncellemesinde inceleme; build başarısız değil |

## 13. Rollback komutları

Komutları ancak \`docs/ota-rollback-runbook.md\` ön koşulları, gerçek incident kimliği,
runtime ve son iyi sürüm doğrulandıktan sonra kullanın:

\`\`\`bash
eas update:revert-update-rollout \
  --group <BAD_GROUP_ID> \
  --message "<INCIDENT_ID>: revert active production rollout" \
  --json --non-interactive

eas update:rollback <BAD_GROUP_ID> \
  --message "<INCIDENT_ID>: restore previous production update" \
  --platform all --json --non-interactive

npx --no-install wrangler rollback <LAST_GOOD_WORKER_VERSION_ID> \
  --env production \
  --message "<INCIDENT_ID>: restore verified last-good Worker" \
  --yes

git revert <RELEASE_COMMIT_SHA>
\`\`\`

Rollback komutları bu çalışmada çalıştırılmadı; canlı sistemde kimlik/binding doğrulanmadan
yer tutucu değerler asla doldurulmamalıdır.

## 14. Nihai karar

Yerel Android release AAB hazırdır:

- Dosya: \`C:\\Users\\Cayan\\Desktop\\SoRita-1.0.101-106-release.aab\`
- Boyut: 75,477,987 bayt
- SHA-256: \`6AF4F5BB57E8952B76A24FF82DE8621868DFE140DD0BE90A8795DD98EB3D885A\`
- Yerel imza kontrolü: \`jarsigner -verify\` \`jar verified\` verdi; self-signed/timestamp/JAR-reader uyarıları kaydedildi
- Beklenen upload sertifikası SHA-1: \`A7:04:1D:7D:DF:1B:C0:25:FA:FB:72:11:C9:4B:7B:2C:86:15:B1:E0\`

Artifact, commit edilmemiş çalışma dizininden üretildiği için mevcut HEAD
\`5aae6a89654a11185240403e91c23114503f22b5\` ile güvenilir biçimde eşleştirilemez.
Yukarıdaki manuel/runtime kanıtlar aynı commit SHA altında saklanana kadar dağıtım onayı
verilmez.

IMPLEMENTATION COMPLETE, RELEASE NO-GO UNTIL LISTED MANUAL/RUNTIME EVIDENCE IS ATTACHED TO THE SAME COMMIT SHA.
