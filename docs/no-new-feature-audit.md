# SoRita yeni özellik eklenmedi denetimi

Tarih: 2026-09-03

Branch: `chore/final-aaa-mvp-hardening-docker-cloudflare-ota`

Başlangıç HEAD: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
Statik kapsam sonucu: `PASS`
Üretim sonucu: `NO-GO`

## Bu geçişte eklenenler ve neden ürün yüzeyi sayılmadıkları

Bu geçiş yalnız iç kalite ve operasyon katmanına dokundu. Aşağıdaki eklerin
hiçbiri son kullanıcıya görünmez; hiçbiri yeni bir kullanıcı işi, ekran, CTA,
bildirim türü, izin, ürün tablosu veya bucket oluşturmaz.

| Ekleme | Tür | Kullanıcıya görünür mü? |
| --- | --- | --- |
| `utils/guards/check-text-encoding.mjs` + testleri | CI guard | Hayır |
| `utils/guards/check-release-scorecard.mjs` + testleri | CI guard | Hayır |
| `quality/release-scorecard.json` | Kanıt artifact'ı | Hayır |
| `check-docker-context.mjs` içindeki iki yeni kontrol | CI guard | Hayır |
| `check-source-health.mjs` backend bütçe geçişi | CI guard | Hayır |
| Production workflow CORS placeholder doğrulaması | Deploy gate | Hayır |
| `docs/audit/`, `docs/ui-ux/` ve rapor dosyaları | Belge | Hayır |
| Üç `.dockerignore` dosyasındaki diff artifact düzeltmesi | Build config | Hayır |

Mevcut ekran, sekme, rota, modal, ayar satırı, bildirim türü, izin, tema ve dil
kapsamı değişmedi. Yeni tema, dark mode, yeni locale, admin paneli veya yeni
ürün yüzeyi eklenmedi.

## Denetim sorusu

Bu denetim yalnız şu soruyu yanıtlar: Mevcut çalışma ağacı, dondurulmuş ürün yüzeyine yeni bir rota, ekran, izin, bildirim türü, API sözleşmesi, ürün tablosu, storage kovası veya Ayarlar eylemi ekliyor mu?

Yanıt, [feature-surface.snapshot.json](../quality/feature-surface.snapshot.json) ile mevcut kaynakları fail-closed karşılaştıran [check-no-new-product-surface.mjs](../utils/guards/check-no-new-product-surface.mjs) üzerinden üretilir. Denetim bir UX kabul testi, canlı veritabanı testi veya yayın onayı değildir.

## Çalıştırılan kontrol

```text
npm run feature-surface:check
```

2026-09-03 yerel sonucu (bu geçişteki tüm değişikliklerden sonra tekrar çalıştırıldı):

```text
10 root routes
4 tabs
13 screen entrypoints
10 notification types
6 Edge Function contracts
18 product tables
3 storage buckets
3 Settings groups
19 Settings CTAs
12 guard tests pass
```

Komut başarıyla tamamlandı. Sayılar kalite skoru değildir; yalnız eşitlik kontrolündeki sözleşme adetleridir.

## Boyut bazında karşılaştırma

| Boyut | Snapshot | Mevcut kaynak | Sonuç |
| --- | ---: | ---: | --- |
| Kök rota | 10 | 10 | `PASS` |
| Sekme | 4 | 4 | `PASS` |
| Ekran girişi | 13 | 13 | `PASS` |
| Bildirim türü | 10 | 10 | `PASS` |
| Bildirim kategorisi | 6 | 6 | `PASS` |
| Edge Function sözleşmesi | 6 | 6 | `PASS` |
| Mobil Edge Function sözleşmesi | 5 | 5 | `PASS` |
| Ürün tablosu | 18 | 18 | `PASS` |
| Storage kovası | 3 | 3 | `PASS` |
| Ayarlar görünümü | 5 | 5 | `PASS` |
| Görünür Ayarlar grubu | 3 | 3 | `PASS` |
| Görünür Ayarlar CTA'sı | 19 | 19 | `PASS` |
| Native izin/entitlement sözleşmesi | Snapshot ile eşit | Snapshot ile eşit | `PASS` |

Tam ad listeleri [existing-feature-contract.md](existing-feature-contract.md) ve snapshot içinde yer alır.

## Mevcut değişikliklerin sınıflandırması

İncelenen değişiklik kümeleri yeni kullanıcı kabiliyeti değil, var olan davranışın altyapı güçlendirmesidir:

| Değişiklik kümesi | Bağlı mevcut özellik | Sınıflandırma |
| --- | --- | --- |
| Tekil Supabase session refresh, logout ve kullanıcı değişiminde merkezi purge | Oturum açma/kapatma ve mevcut kullanıcı oturumu | Mevcut güvenlik/yarış durumu düzeltmesi |
| Kullanıcı/oturum nesline bağlı özel imzalı medya URL yönetimi | Var olan özel mekân medyası | Mevcut yetki ve önbellek sertleştirmesi |
| Başlangıç query cache'i ve görünür veri cache'i sınırlandırması | Var olan offline okuma | Mevcut veri izolasyonu/dayanıklılık düzeltmesi |
| Auth identifier hash, kolon ayrıcalığı ve mass-assignment migration'ı | Var olan kimlik doğrulama/profil | Mevcut güvenlik sertleştirmesi |
| Lease tabanlı hesap silme sagası | Var olan hesap silme CTA'sı | Mevcut güvenilirlik sertleştirmesi |
| Seçici Cloudflare gateway ve direct/gateway cutover | Var olan beş mobil Edge Function | Mevcut ağ sınırı; yeni genel ürün API'si değil |
| Preview/production OTA kanıt ve rollout workflow'ları | Var olan uygulama dağıtımı | Operasyonel yayın kontrolü |
| Snapshot/guard ve release-evidence şeması | Mevcut kapsamın korunması | Test/kanıt altyapısı |
| Push token capability, tombstone, arka plan dedupe ve güvenilir tap yönlendirmesi | Var olan 10 bildirim türü ve `Notifications`/mevcut detay rotaları | Mevcut teslim/lifecycle güvenlik ve yarış durumu düzeltmesi |
| Push outbox receipt/DLQ/health/requeue migration ve CLI | Var olan push teslim operasyonu | İç operasyon/dayanıklılık; yeni bildirim türü veya admin paneli değil |
| Deterministik Docker mock, Worker/DB/fault/load profilleri | Var olan map/edge/backend sözleşmelerinin test edilmesi | Yalnız test/CI altyapısı; mobil runtime veya yeni ürün servisi değil |
| Bounded Cloudflare origin response doğrulaması ve request-owned JWKS fetch | Var olan beş seçici Edge Function geçidi | Mevcut ağ güvenliği/izolasyonu; yeni public ürün route'u değil |
| EAS build kimliği ve OTA certificate fail-closed doğrulayıcıları | Var olan uygulama dağıtımı | Release güvenliği; yeni kullanıcı ayarı veya akışı değil |
| `1.0.102` / Android 107 / iOS 87 sürüm artışı | Var olan native uygulama ve appVersion runtime | Release metadata; ürün kapsamı değişmez |

Cloudflare Worker'ın `/health` rotası operasyonel sağlık kontrolüdür. Guard'daki dar kapsamlı iç altyapı istisnaları kullanıcıya görünür ürün yüzeyi sayılmaz; yine de yeni ürün davranışına dönüşürlerse bu rapor otomatik onay vermez.

## Fail-closed kuralları

Guard aşağıdaki durumlarda başarısız olmalıdır:

- Kaynak söz dizimi güvenilir biçimde ayrıştırılamadığında.
- Snapshot'ta bulunmayan ürün rotası/ekranı/sekmesi oluştuğunda.
- Yeni native izin, entitlement veya arka plan modu eklendiğinde.
- Yeni bildirim türü/kategorisi ya da görünür Ayarlar eylemi eklendiğinde.
- Yeni mobil Edge Function veya ürün tablosu/storage kovası eklendiğinde.
- İç altyapı istisnası ürün benzeri ad veya davranışla kötüye kullanıldığında.

Snapshot değişikliğinin aynı PR içinde yapılması otomatik olarak meşru kapsam değişikliği oluşturmaz. Ayrı ürün kararı ve insan incelemesi gerekir.

## Kanıt sınırı

- Statik yeni-özellik denetimi: `VERIFIED (LOCAL, PRE-COMMIT)`.
- Ekranların gerçek cihazda yalnız mevcut özellikleri gösterdiği: `UNVERIFIED`.
- Remote config, canlı veritabanı veya dağıtılmış backend'in snapshot dışı davranış üretmediği: `UNVERIFIED`.
- Cloudflare, Supabase ve EAS'teki gerçek deploy içeriğinin bu çalışma ağacıyla aynı SHA olduğu: `UNVERIFIED`.

Sonuç: Bu çalışma ağacında statik olarak yeni ürün yüzeyi tespit edilmedi. Yeni
push modülleri yalnız mevcut bildirim türlerini işler; Docker/Cloudflare/EAS
ekleri iç test ve release altyapısıdır. Bu dar denetim `PASS`tir. Çalışma ağacı
henüz candidate commit olmadığı ve runtime/provider kanıtları eksik olduğu için
genel üretim kararı `NO-GO`dur; aynı guard temiz candidate SHA üzerinde tekrar
çalıştırılmalıdır.
