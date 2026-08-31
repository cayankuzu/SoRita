# SoRita release readiness

Son repo incelemesi: 2026-08-30

İncelenen branch: `chore/aaa-mvp-feature-freeze-cloudflare-ota`

Üretim kararı: `NO-GO`

## Kararın anlamı

Bu belge mevcut çalışma ağacının yayın kapısıdır. Kaynakta bir kontrol, workflow veya runbook bulunması; ilgili CI koşusunun, sağlayıcı yapılandırmasının, signed binary'nin, cihaz testinin ya da dağıtımın gerçekleştiğini kanıtlamaz.

İnceleme anında çalışma ağacı değiştirilmiş ve izlenmeyen dosyalar içeriyordu. Bu nedenle mevcut içerik HEAD commit'ine veya uzak branch'e eşit kabul edilemez; immutable candidate SHA ve temiz ağaç release manifest'i yoktur. Yerel kısmi geçişler değerli geliştirme kanıtıdır fakat üretim attestation'ı değildir.

Durum sözlüğü:

- `VERIFIED (STATIC)`: Dosya/sözleşme repo içinde incelendi.
- `VERIFIED (LOCAL)`: Komut bu çalışma ağacında geçti; canlı servis/cihaz kanıtı değildir.
- `UNVERIFIED`: Gerekli dış veya aynı-SHA kanıt sunulmadı.
- `NO-GO`: Yayın ilerlemesini durduran kapı.

## Güncel repo tabanı

| Alan | 2026-08-30 gerçeği | Durum |
| --- | --- | --- |
| Ürün kapsamı | Snapshot 10 kök rota, 4 sekme, 13 ekran girişi, 10 bildirim türü, 6 Edge Function, 18 ürün tablosu ve 3 bucket donduruyor; dar isimli private operasyon tablolarını ayrı doğruluyor | `VERIFIED (LOCAL)` — `npm run feature-surface:check` 12/12 guard testiyle geçti |
| Tam kalite kapısı | `npm run check:release`; Expo, lint, feature freeze, OTA/evidence araçları, typecheck, dead code, kritik akış kanıtı, performans, audit/license/provenance, test, security ve coverage içeriyor | Tanım `VERIFIED (STATIC)`; temiz immutable SHA üzerinde tam koşu `UNVERIFIED` |
| Kalite CI | `.github/workflows/quality.yml`; root ve Worker kapıları, Semgrep ve full-history Gitleaks içeriyor | Tanım `VERIFIED (STATIC)`; başarılı uzak run ID `UNVERIFIED` |
| Veritabanı CI | `.github/workflows/database-validation.yml`; reset, migration replay, DB lint, pgTAP RLS/IDOR ve ayrı DB'ye dump/restore içeriyor | Tanım `VERIFIED (STATIC)`; başarılı uzak run ID `UNVERIFIED` |
| Release evidence | `.github/workflows/release-evidence.yml` aynı SHA Quality/Database run'larını doğrulayıp checksum manifest'i üretir | Workflow kasıtlı olarak eksik dış kanıtı `unverified` yazıp production verifier'ın reddettiğini kanıtlar; tam attestation yok |
| Supabase değişiklikleri | 2026-08-30 auth/mass-assignment, hesap silme saga, private-cover yetkisi, moderation case ve Cloudflare origin nonce migration kaynakları çalışma ağacında | Kaynak `VERIFIED (STATIC)`; local reset ve staging/production apply `UNVERIFIED` |
| Legacy private cover | Bounded dry-run/apply utility, unsafe-path rehome, public→private client rehome ve DB private-path guard kaynağı çalışma ağacında | Kaynak `VERIFIED (STATIC)`; aynı-SHA test, staging canlı erişim/rollback, Storage backup ve retention/deletion onayı `UNVERIFIED`; production apply `NO-GO` |
| Cloudflare | Seçici Worker, testler, preview ve production canary workflow'ları kaynakta | Provider account/DNS/WAF/secrets/deploy/origin enforcement `UNVERIFIED`; `NO-GO` |
| EAS/OTA | `appVersion` runtime, preview/production workflow, aynı-SHA binary kanıt kapısı ve kademeli rollout tanımlı | EAS owner/project/channel, update signing, binary ve yayın `UNVERIFIED`; `NO-GO` |
| Android/iOS | Android native proje mevcut; iOS native proje checked-in değil ve EAS/prebuild gerekir | Release signing, Internal Track/TestFlight ve gerçek cihaz sonucu `UNVERIFIED`; `NO-GO` |
| Observability/SLO | Sentry/metric/log kaynakları var; `docs/slo.md` rakamları provisional/unmeasured policy | Dashboard, alert, retention, owner ve burn testleri `UNVERIFIED`; `NO-GO` |
| Backup/restore | CI yalnız izole yerel Postgres dump/restore tatbikatı tanımlar | Hosted backup/PITR, Storage object backup ve staging restore `UNVERIFIED`; `NO-GO` |
| Moderasyon | Raporlama/block mevcut; çalışma ağacı service-role-only case/event/RPC ve CLI kaynağı ekliyor; admin panel yok | Kaynak `VERIFIED (STATIC)`; migration/CLI staging çalışması, onaylı operatör/policy/SLA/appeal ve store UGC kanıtı `UNVERIFIED`; `NO-GO` |

Detaylı ürün sözleşmesi [existing-feature-contract.md](./existing-feature-contract.md), başlangıç kanıt matrisi [aaa-mvp-baseline.md](./aaa-mvp-baseline.md), yeni özellik denetimi [no-new-feature-audit.md](./no-new-feature-audit.md), ağ/veri envanteri [network-and-data-inventory.md](./network-and-data-inventory.md) ve offline sözleşmesi [offline-and-concurrency-contract.md](./offline-and-concurrency-contract.md) içindedir.

## Repo kapıları

Temiz bir candidate checkout üzerinde:

```powershell
npm ci --ignore-scripts
npm run check:release

Push-Location infra/cloudflare/sorita-edge
npm ci --ignore-scripts
npm run check
npm audit --audit-level=high
npm run dry-run:preview
npm run dry-run:production
Pop-Location

git diff --exit-code
git status --porcelain=v1 --untracked-files=all
```

Güvenli beklenen sonuç: her komut sıfır exit code ile biter; son iki Git komutu hiçbir değişiklik üretmez. Bu koşu hedef SHA, Node/CLI sürümü ve log checksum'larıyla [release evidence contract](../release-evidence/README.md) içine alınmalıdır. Mevcut kirli çalışma ağacında bu attestation üretilemez.

## Veritabanı ve backend kapısı

İzole yerel ve CI kapıları:

```powershell
supabase start
supabase db reset --local
supabase db lint --local --level error
supabase test db --local
```

Dump/restore tatbikatının exact Linux komutları [database-validation.yml](../.github/workflows/database-validation.yml) içindedir. `supabase db reset --linked` üretim veya staging üzerinde çalıştırılmaz.

Sonraki kapı, aynı migration setinin ayrı staging projesinde tek yetkili operatör tarafından uygulanması; migration listesi/drift, RLS/IDOR, Edge Function, Storage policy, auth e-posta/deep-link, push, hesap silme sagası, moderation ledger ve origin nonce akışının doğrulanmasıdır. 2026-08-30 çalışma ağacı migration'larının yerel veya staging çalıştırma kanıtı bulunmadığından backend `NO-GO`dur.

## Cloudflare kapısı

Preview workflow; Worker check/audit/dry-run, korumalı environment değişkenleri, secrets-file ve `/health` no-store sözleşmesi tanımlar. Production workflow; aynı SHA Quality/Database/Preview run ID'lerini, önceki Worker version ID'sini ve açık production onayını zorunlu kılar; önce %5 canary açar ve sonraki %25/%50/%100 adımlarını manuel bırakır.

Bunların hiçbiri dashboard gerçeğini kanıtlamaz. Özellikle şu kanıtlar yoktur:

- Gerçek account/zone, least-privilege API token, custom domain/DNS/TLS ve `workers.dev` kararı.
- WAF/body/method/bot/cache bypass kuralları ve alarmları.
- Ortama özel Rate Limiting namespace/binding ve secret kurulumu.
- Kaynakta tanımlı seçili beş Supabase origin için Worker HMAC, timestamp ve atomik nonce enforcement'ın migration/deploy/secret/flag kanıtı; required flag öncesi eski binary uyumluluğu/retirement kararı.
- Enforcement açıkken direct-origin negatif/replay testi, preview deploy, canlı canary ve rollback tatbikatı.

Ayrıntı [cloudflare-architecture.md](./cloudflare-architecture.md), [cloudflare-route-matrix.md](./cloudflare-route-matrix.md) ve [cloudflare-threat-model.md](./cloudflare-threat-model.md) içindedir. Cloudflare production: `NO-GO`.

## Binary, cihaz ve store kapısı

Aynı source SHA/runtime için imzalı Android ve iOS preview/store binary kimlikleri saklanmalıdır. Aşağıdakiler iki platformda gerçek cihaz kanıtı ister:

- Auth cold/warm start, kayıt, doğrulama ve gerçek parola reset deep link'i.
- Feed/explore/map/profile/liste/yorum/sosyal/notification akışları ve iki kullanıcı izolasyonu.
- Foreground/background/terminated push yönlendirmesi.
- Kamera, galeri, fotoğraf/video upload, private media, düşük depolama/bellek ve kesintili ağ.
- Offline outbox, app kill/restart, kullanıcı değişimi ve token refresh yarışları.
- Small/large screen, klavye, Dynamic Type, VoiceOver, TalkBack, kontrast ve reduced motion.
- Cold/warm start, first content, navigation, scroll/frame, bellek ve batarya ölçümü.

Sonra aynı binary Android Internal Track ve TestFlight'ta install/update/smoke testinden geçmelidir. Store privacy/data-safety, UGC report/block/moderation, hesap silme ve iletişim bilgisi beyanları gerçek uygulama davranışıyla karşılaştırılmalıdır. Bunların tümü `UNVERIFIED` ve `NO-GO`dur.

## OTA ve rollout kapısı

[ota-runtime-and-release.md](./ota-runtime-and-release.md) runtime/binary sözleşmesini, [ota-rollback-runbook.md](./ota-rollback-runbook.md) rollback yollarını tanımlar. Preview ve production workflow'larının bulunması yayın kanıtı değildir.

Production OTA yalnız şu zincirden sonra değerlendirilebilir:

1. Temiz immutable SHA.
2. Aynı SHA için başarılı Quality ve Database run ID'leri.
3. Aynı runtime/source SHA'ya bağlı imzalı Android+iOS binary evidence ve provider doğrulaması.
4. `OTA_SAFE` sınıflandırması ve tam release gate.
5. Preview update + iki platform gerçek cihaz smoke/rollback.
6. Onaylı SLO sorguları ve alert routing.
7. Production %5 canary; her aşamada ayrı onayla %20/%50/%100.

Hold süreleri ve SLO sahipliği onaylanmamıştır; rakam uydurulamaz. Bunlar belirlenene kadar canary promotion `NO-GO`dur.

## Operasyon ve gizlilik kapısı

- SLO/observability: [observability-slo-runbook.md](./observability-slo-runbook.md).
- Hosted backup/PITR ve restore: [backup-restore-runbook.md](./backup-restore-runbook.md).
- Güvenlik olayı: [security-incident-response.md](./security-incident-response.md).
- Admin panel olmadan mevcut moderasyon: [moderation-without-admin-panel.md](./moderation-without-admin-panel.md).
- Tüm yetkili dış işlemler: [MANUAL_STEPS.md](./MANUAL_STEPS.md).

Formal retention süreleri, provider log retention, olay paging sahibi, moderation SLA/appeal, backup RPO/RTO ve store beyan onayları yoktur. Sahip bilinmeyen her işlem `OWNER_TBD` olarak kalır.

## GO için asgari kanıt paketi

`GO` ancak tek bir candidate SHA için aşağıdakilerin tamamı checksum-bound evidence manifest'inde bulunduğunda verilebilir:

1. Temiz repo + başarılı Quality, Database ve release evidence koşuları.
2. Staging Supabase deploy/drift/RLS/Edge/Storage ve izole restore kanıtı.
3. Legacy private-list cover audit; gerekiyorsa staging migration, owner/unrelated access, Storage backup ve rollback kanıtı.
4. Cloudflare preview, HMAC direct-origin negatif test, dashboard export ve rollback kanıtı veya onaylı `direct` mod kararı.
5. İmzalı Android/iOS binary provenance ve gerçek cihaz matrisi.
6. Internal Track/TestFlight smoke, privacy/UGC/store checklist onayı.
7. Sentry/provider event alımı, source map, dashboard, alert routing ve provisional SLO ölçüm raporu.
8. Hosted backup/PITR uygunluğu, Storage object recovery ve restore tatbikatı.
9. OTA preview, canary aşama onayları ve gerçek rollback.
10. Açık kritik/yüksek güvenlik, veri kaybı, gizlilik veya kullanıcılar arası izolasyon bulgusunun olmaması.

Bu paket mevcut değildir. 2026-08-30 nihai yayın kararı: `NO-GO`.
