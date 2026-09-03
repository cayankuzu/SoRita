# SoRita release readiness

Son repo incelemesi: 2026-09-03

İncelenen branch: `chore/final-aaa-mvp-hardening-docker-cloudflare-ota`

Önceki HEAD: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`

Candidate SHA: `86702f86c06d57a05a668bebf47bdb91e7b0636f` (immutable branch commit)

Kaynak sürümü: `1.0.102`; Android `107`; iOS `87`

Üretim kararı: **`NO-GO`**

## Kararın anlamı

Kaynakta bir kontrol, workflow veya runbook bulunması; sağlayıcı
yapılandırmasının, signed binary'nin, cihaz testinin ya da dağıtımın gerçekten
tamamlandığını kanıtlamaz.

### Kanıt sınıfları

Bir sonucun hangi ortamda üretildiği, sonucun kendisi kadar önemlidir. Yerel bir
PASS'i CI PASS gibi sunmak bu belgenin en büyük hatası olurdu. Bu nedenle her
kanıt aşağıdaki sınıflardan biriyle etiketlenir:

| Sınıf | Anlamı | Nerede üretilir |
| --- | --- | --- |
| `STATIC` | Kod/sözleşme incelemesi | Repository |
| `CI` | GitHub Actions, candidate SHA'ya bağlı | GitHub-hosted runner |
| `LOCAL_RUNTIME` | Geliştirici makinesi / yerel container | Workstation |
| `PROVIDER` | Supabase, Cloudflare, EAS, Sentry kontrol düzlemi | Sağlayıcı paneli/API |
| `DEVICE` | Fiziksel Android/iOS cihaz | Gerçek donanım |
| `STORE` | TestFlight / Play Internal | Mağaza kanalları |

Her kanıt kaydı şunları taşımalıdır: candidate SHA, run ID, zaman damgası,
ortam, artifact SHA-256 ve sonuç.

`LOCAL_RUNTIME` sonuçları release attestation değildir. Bu belgede yerel olarak
doğrulanan her satır açıkça `LOCAL_RUNTIME` olarak işaretlenmiştir ve aynı-SHA
`CI` sonucu geldiğinde yükseltilmelidir.

Durum sözlüğü:

- `VERIFIED (STATIC)`: Dosya/sözleşme repo içinde incelendi.
- `VERIFIED (LOCAL)`: Komut mevcut çalışma ağacında geçti; canlı servis/cihaz
  kanıtı değildir.
- `VERIFIED (CI)`: Candidate SHA için GitHub Actions'ta geçti.
- `UNVERIFIED`: Gerekli dış veya aynı-SHA kanıt eklenmedi.
- `BLOCKED`: Mevcut yetki/plan/ortam işi güvenli biçimde tamamlamaya izin vermiyor.
- `NO-GO`: Release ilerlemesini durduran kapı.

## Candidate SHA CI durumu

`86702f8` için ilk CI koşusu üç kırmızı kapı üretti. Hepsinin kök nedeni
bulundu ve düzeltildi; düzeltmeler bir sonraki commit'te doğrulanacaktır.

| Kapı | İlk sonuç | Kök neden | Durum |
| --- | --- | --- | --- |
| `Lint & Type Check` | failure | knip, `expo-updates`'i unused sayıyordu. Paketin hiç JS import'u yok; yalnız Expo config ve Android native manifest tarafından tüketiliyor. Knip'in Expo plugin'i bunu ancak `app.config.ts` bir update URL ile değerlendiğinde çözebiliyordu, yani sonuç `.env` varlığına göre değişiyordu. | Düzeltildi: gerekçelendirilmiş dar exception + `check-knip-exceptions.mjs` guard'ı |
| `Repository release gates` | failure | Aynı knip kök nedeni | Düzeltildi |
| `Docker Validation` | failure | `docker buildx build --provenance=mode=max --sbom=true` varsayılan `docker` driver ile çalışıyordu: `Attestation is not supported for the docker driver`. Image hiç oluşmadı, SBOM ve evidence manifest de zincirleme düştü. | Düzeltildi: pinned `setup-buildx-action` + `docker-container` driver + driver doğrulaması |
| `Unit Tests` | **skipped** | `Lint & Type Check` başarısız olunca `needs` zinciri testleri hiç çalıştırmadı. GitHub, required check `skipped` ise bunu sağlanmış sayar. | Düzeltildi: `Release gates green` aggregator'ı, `if: always()` ile çalışır ve `success` olmayan her required job'ı kırmızıya çevirir |

Bu tablodaki en önemli satır sonuncusudur: bir kapının **atlanmış** olması,
geçmiş olması anlamına gelmez. Aggregator bu boşluğu kapatır.

## Güncel readiness özeti

| Alan | Güncel gerçek | Durum |
| --- | --- | --- |
| Ürün kapsamı | 10 kök rota, 4 sekme, 13 ekran girişi, 10 bildirim türü, 6 Edge Function, 18 ürün tablosu, 3 bucket, 3 Settings grubu, 19 CTA korunuyor | `VERIFIED (LOCAL)` — 12/12 feature-surface guard testi geçti; aynı-SHA CI bekliyor |
| Sürüm/native | App `1.0.102`, Android 107, iOS 87; Gradle release channel profile/property allowlist ile ayrılıyor | `VERIFIED (STATIC)`; final merged-manifest, signed Android+iOS build ve provider identity `UNVERIFIED` |
| Root kalite | `typecheck`, `lint` (tüm guard'lar dahil) ve 167 dosya/932 test geçti; `security:verify` 8 dosya/117 test geçti | `VERIFIED (LOCAL)`; temiz checkout'ta aynı-SHA `check:release` bekliyor |
| Supabase | Güncel migration seti zero-reset edildi; lint boş; 6 dosya/180 pgTAP geçti; ayrı DB restore 22 public tablo doğruladı | `VERIFIED (LOCAL)`; hosted staging/apply/drift ve hosted restore `UNVERIFIED` |
| Push | Startup izin prompt'u kaldırıldı; token capability/tombstone, account-switch, verified tap, background dedupe, delivery DLQ/health/requeue güçlendirildi | Kaynak ve hedefli test `VERIFIED (LOCAL)`; FCM/APNs/Expo credential, receipt/scheduler alarmı ve iki-platform cihaz matrisi `UNVERIFIED / NO-GO` |
| Cloudflare | Bounded origin parsing/schema, request-owned JWKS, no-store ve fail-closed Worker sözleşmesi; 3 dosya/34 test ve iki dry-run geçti | `VERIFIED (LOCAL)`; account/DNS/TLS/WAF/secrets/deploy/origin enforcement/canary `UNVERIFIED / NO-GO` |
| Docker | Build context'i bozan `+!App.tsx` diff artifact'ı düzeltildi; `docker:test` uçtan uca exit 0: container profili 34 Worker testi, temiz Supabase reset + migration replay, lint hatasız, 6 dosya/180 pgTAP, dump/restore parity (22 tablo, 70 routine, 50 RLS policy, 3 bucket); `docker:load:smoke` 122.370 istek 0 hata | `VERIFIED (LOCAL)`; aynı-SHA CI/SBOM/provenance `UNVERIFIED` |
| OTA | Runtime/channel/build identity/OTA classifier ve otomatik rollback kapıları güçlendirildi; 38 OTA/EAS testi geçti | `VERIFIED (LOCAL)`; signed provider update ve device rollback yok |
| OTA code signing | Workflow geçerli tracked RSA certificate olmadan fail-closed | Mevcut EAS Free planında özellik kullanılamıyor: `BLOCKED / NO-GO` |
| Release evidence | Manifest v2 Docker ve OTA-signing durumunu kapsar; binary input'u provider build identity ile doğrulanır | `VERIFIED (STATIC/LOCAL)`; final same-SHA attestation ve başarılı remote run yok |
| Android/iOS | Yeni native/runtime candidate iki platform yeni binary gerektirir | `1.0.102`/107 AAB ve iOS 87 same-SHA signed artifact `UNVERIFIED / NO-GO`; eski 1.0.101/106 artifact geçersiz |
| Cihaz/store | Fiziksel Android+iOS push/auth/upload/offline/a11y/perf; Internal Track/TestFlight; privacy/UGC | `UNVERIFIED / NO-GO` |
| Observability/SLO | Redacted log/request/DLQ sözleşmeleri kaynakta | Sentry source map, event, alert, owner ve ölçülmüş SLO `UNVERIFIED / NO-GO` |
| Backup/restore | İzole yerel DB dump/restore geçti | Hosted backup/PITR, private Storage restore ve onaylı RPO/RTO `UNVERIFIED / NO-GO` |

35 alanlı ayrıntılı kanıt tavanı ve karar tablosu
[aaa-mvp-final-report.md](./aaa-mvp-final-report.md) içindedir. Hiçbir alana
aynı-SHA runtime/operasyon kanıtı olmadan 9.80 verilmemiştir.

## Çalıştırılmış yerel kanıt

2026-09-03 tarihli tam gate taraması (bu çalışma ağacı):

```text
typecheck (app + tests):                     PASS
lint + architecture/source-health/ui-copy/
  ui-tokens/accessibility/feature-surface:   PASS
feature-surface guard:                       12/12 PASS
release-scorecard guard:                     7/7 PASS (35 kategori, hepsi 9.80 altı)
OTA/EAS classifier + evidence testleri:      44/44 PASS
deployment-workflows guard:                  15/15 PASS
release-evidence guard:                      8/8 PASS
ops CLI testleri:                            18/18 PASS
root test suite:                             167 dosya / 932 test PASS
security:verify:                             8 dosya / 117 test PASS
dead-code (knip):                            temiz
test:coverage:                               PASS — branches %90,08
                                             statements %94,53, lines %94,74,
                                             functions %94,10
security:audit:prod:                         PASS — 0 critical, 0 high,
                                             4 moderate, 1 gerekçeli acceptance

docker:config:                               PASS (8 profil)
docker:test (uçtan uca, exit 0):
  - container profili Worker:                3 dosya / 34 test PASS
  - Supabase temiz reset + migration replay: PASS
  - db lint (error seviyesi):                results=[]
  - pgTAP:                                   6 dosya / 180 test PASS
  - dump + izole restore parity:             22 tablo, 70 routine,
                                             50 RLS policy, 3 bucket PASS
docker:load:smoke (exit 0):                  122.370 istek / 0 hata (%0,00)
                                             24.474 iterasyon, 2.437,67/s
                                             p90 1,08 ms, p95 1,64 ms
                                             5 akışta no-store doğrulandı
```

`docker:load:smoke` deterministik mock upstream'e karşı çalışır. Latency
değerleri harness ölçümüdür, kapasite kanıtı **değildir**. Bu profilin gerçek
kanıtı, 122.370 istek boyunca beş temsilci akışın da `no-store` dönmesidir;
yani shared cache üzerinden kullanıcılar arası sızıntı yüzeyi oluşmamaktadır.
10.000 eşzamanlı kullanıcı hedefi bu commit'te **gösterilmemiştir**.

### Bu geçişte bulunan ve düzeltilen kusurlar

Bunlar devralınan bulgu listesinde yoktu; raporları okuyarak değil, gate'leri
çalıştırarak bulundu.

| # | Kusur | Etki | Durum |
| --- | --- | --- | --- |
| 1 | Üç `.dockerignore` dosyasında `+!App.tsx` diff artifact'ı | Docker build context `App.tsx`'i dışlıyordu; **tüm Docker kalite ortamı çalışmıyordu** | Düzeltildi; guard iki katmanda fail-closed |
| 2 | `docker-validation.yml` yalnız `docker:worker` çalıştırıyordu | Temiz Supabase reset, migration replay, pgTAP ve dump/restore Docker hattında hiç koşmuyordu | `docker:test`'e çevrildi |
| 3 | Production Worker deploy'u CORS allowlist'i doğrulamıyordu | `https://app.sorita.invalid` ile production version yüklenebilirdi | Bare HTTPS origin zorunlu; placeholder fail-closed |
| 4 | Runtime-evidence fixture'ları kendi şemalarına göre bayattı | Evidence pipeline'ı doğrulanmamıştı; 8 testten 2'si kırıktı | v2 fixture'lara güncellendi |
| 5 | Complexity bütçeleri backend'i kapsamıyordu | 2.095 satırlık `media-assets/handler.ts` bütçesizdi | Backend bütçe geçişi eklendi, ratchet'li |
| 6 | İki HIGH production advisory açıktı; iki acceptance bayattı | `browserslist` OOM/prototype-write; artık ağaçta olmayan `image-size` için acceptance duruyordu | 3 advisory override ile **düzeltildi**; bayat acceptance'lar silindi; 1 moderate gerekçeli acceptance |
| 7 | Branch coverage kendi eşiğinin altındaydı (%89,56 < %90) | Coverage kapısı kırıktı | Eşik düşürülmedi; push/auth/geocoding/origin-HMAC için gerçek testler eklendi → **%90,08** |

Kusur 1 ve 3 için guard'lar hata yeniden üretilerek doğrulandı: bug geri
konulduğunda guard fail etti, geri alındığında pass etti.

Kusur 6 sonrası production audit durumu: **0 critical, 0 high, 4 moderate**,
1 gerekçeli ve süreli acceptance. Acceptance kaydı artık owner, reason,
exploitability ve expiry zorunlu tutar; eksikse build fail eder.


## Temiz candidate repo kapısı

```powershell
npm ci --ignore-scripts
npm run check:release
npm run docker:config
npm run docker:test
npm run docker:resilience
npm run docker:load

Push-Location infra/cloudflare/sorita-edge
npm ci --ignore-scripts
npm run check
npm run dry-run:preview
npm run dry-run:production
Pop-Location

git diff --exit-code
git status --porcelain=v1 --untracked-files=all
```

Güvenli beklenen sonuç: her komut sıfır exit code ile biter; son iki Git komutu
çıktı üretmez. CI logları ve artifact checksum'ları aynı candidate SHA ile
release-evidence manifestine bağlanır. Full-history secret scan ve repository
release gates de aynı SHA'da geçmeden yayın ilerlemez.

## Supabase kapısı

Yerel zero-reset/lint/pgTAP/dump-restore geçti. Bu, bağlı hosted projeye mutation
yetkisi vermez. Sonraki zorunlu zincir:

1. Ayrı bir staging project ref'inin yetkili owner tarafından doğrulanması.
2. Migration history/drift ve `db push --dry-run` review.
3. Forward-only apply; eski ve yeni push RPC overload'larıyla kabul testi.
4. Anon/user-A/user-B/blocked/service-role RLS/IDOR, Auth, Storage, push
   scheduler/receipt, account deletion ve Edge Function testi.
5. İzole hosted restore ve Storage object recovery.
6. Ayrı production change approval; production reset kesinlikle yok.

Linked mevcut projenin staging olduğu kanıtlanmadığı için migration push'u
yapılmamıştır. Hosted Supabase release kapısı `NO-GO`dur.

## Cloudflare kapısı

Worker check ve dry-run başarılı olsa da aşağıdaki provider kanıtları yoktur:

- least-privilege account/token ve protected preview/production environment;
- owned custom domain, DNS/TLS ve istenmeyen public route kapatma;
- gerçek WAF/body/method/bot/cache/rate-limit kuralları ve sanitized export;
- ortama özel secrets/bindings ve selected-origin HMAC parity;
- enforcement açıkken missing/invalid/expired/replayed direct-origin negatif
  testi ve doğru imzalı edge pozitif testi;
- preview deploy, production canary, health/SLO hold ve last-good rollback.

Provider deploy yapılmadı. Cloudflare production `NO-GO`dur.

## OTA, binary ve cihaz kapısı

Bu çalışma native/config ve version değişikliği içerdiğinden
`NATIVE_BUILD_REQUIRED` sınıfındadır. Production OTA kullanılamaz. Sıra:

1. Temiz immutable candidate SHA ve aynı-SHA kalite/DB/Docker evidence.
2. EAS Update code signing desteği için onaylı plan/kurumsal karar; private key
   repo dışında, public certificate yeni binary'lerde.
3. Provider'dan sorgulanarak doğrulanan Android `1.0.102`/107 ve iOS 87 build
   identity/artifact'ları.
4. Preview update; doğru/wrong runtime, signed/unsigned/tampered, embedded/offline
   startup ve rollback testleri fiziksel Android+iOS cihazlarda.
5. Play Internal Track/TestFlight install, push lifecycle, auth/deep link,
   private media/upload, offline/outbox, accessibility ve performance matrisi.
6. Yalnız tüm kanıtlar aynı SHA'da ise production %5 → %20 → %50 → %100
   rollout; her adımda onay/hold ve otomatik rollback.

Mevcut EAS Free planı signed OTA'yı desteklemediği için 2. adım çözülmeden
production OTA doğrudan `BLOCKED / NO-GO`dur.

## Operasyon ve store kapısı

- SLO/observability: [observability-slo-runbook.md](./observability-slo-runbook.md)
- Hosted backup/PITR: [backup-restore-runbook.md](./backup-restore-runbook.md)
- Güvenlik olayı: [security-incident-response.md](./security-incident-response.md)
- Push incident/rotation: [push-incident-and-credential-rotation-runbook.md](./push-incident-and-credential-rotation-runbook.md)
- Dış işlemler ve kanıt yolları: [MANUAL_STEPS.md](./MANUAL_STEPS.md)

Provider owner'ları, ölçülmüş SLO/RPO/RTO, alert routing, store privacy/data
safety/UGC ve moderation SLA/appeal kanıtları yoktur. Bunlar uydurulamaz.

## GO için asgari kanıt paketi

`GO` ancak tek bir immutable candidate SHA için aşağıdakilerin tamamı
checksum-bound manifestte bulunduğunda verilebilir:

1. Clean repo; Quality, Database, Docker, Security ve Release Evidence başarılı
   remote run kimlikleri.
2. Staging Supabase deploy/drift/RLS/Edge/Storage/push ve hosted restore.
3. Cloudflare preview, dashboard export, origin direct-negative/replay, canary ve
   rollback.
4. Provider-doğrulamalı signed Android+iOS binary ve code-signing chain.
5. Android+iOS fiziksel cihaz matrisi, Internal Track/TestFlight smoke.
6. Push credential/ticket/receipt/invalid-token/scheduler/alert kanıtı.
7. Sentry source maps/events/alerts ve ölçülmüş SLO.
8. Hosted DB/PITR ve private Storage recovery.
9. OTA preview, signature negatifleri, staged rollout ve rollback.
10. Store privacy/data-safety/UGC ve named owner approvals; açık kritik/yüksek
    güvenlik, gizlilik, veri kaybı veya kullanıcılar arası izolasyon bulgusu yok.

Bu paket mevcut değildir. 2026-08-31 nihai release kararı: **`NO-GO`**.

IMPLEMENTATION COMPLETE, RELEASE NO-GO UNTIL LISTED MANUAL/RUNTIME EVIDENCE IS ATTACHED TO THE SAME COMMIT SHA.
