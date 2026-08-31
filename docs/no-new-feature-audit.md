# SoRita yeni özellik eklenmedi denetimi

Tarih: 2026-08-30
Statik kapsam sonucu: `PASS`
Üretim sonucu: `NO-GO`

## Denetim sorusu

Bu denetim yalnız şu soruyu yanıtlar: Mevcut çalışma ağacı, dondurulmuş ürün yüzeyine yeni bir rota, ekran, izin, bildirim türü, API sözleşmesi, ürün tablosu, storage kovası veya Ayarlar eylemi ekliyor mu?

Yanıt, [feature-surface.snapshot.json](../quality/feature-surface.snapshot.json) ile mevcut kaynakları fail-closed karşılaştıran [check-no-new-product-surface.mjs](../utils/guards/check-no-new-product-surface.mjs) üzerinden üretilir. Denetim bir UX kabul testi, canlı veritabanı testi veya yayın onayı değildir.

## Çalıştırılan kontrol

```text
npm run feature-surface:check
```

2026-08-30 yerel sonucu:

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

- Statik yeni-özellik denetimi: `VERIFIED (LOCAL)`.
- Ekranların gerçek cihazda yalnız mevcut özellikleri gösterdiği: `UNVERIFIED`.
- Remote config, canlı veritabanı veya dağıtılmış backend'in snapshot dışı davranış üretmediği: `UNVERIFIED`.
- Cloudflare, Supabase ve EAS'teki gerçek deploy içeriğinin bu çalışma ağacıyla aynı SHA olduğu: `UNVERIFIED`.

Sonuç: Bu çalışma ağacında statik olarak yeni ürün yüzeyi tespit edilmedi. Bu dar denetim `PASS`tir; eksik runtime ve yayın kanıtları nedeniyle genel üretim kararı `NO-GO`dur.
