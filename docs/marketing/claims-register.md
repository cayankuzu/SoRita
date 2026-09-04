# SoRita iddia kütüğü (claims register)

Tarih: 2026-09-04
Aday commit: `chore/final-release-candidate-aaa`
Sahip: Cayan Kuzu

Bu kütük pazarlama paketinin omurgasıdır. **Burada satırı olmayan bir iddia
mağaza sayfasında, reklamda veya sunumda kullanılamaz.** Kural tek yönlüdür:
önce kanıt, sonra cümle.

`utils/guards/check-marketing-claims.mjs` bu dosyayı makine olarak okur. Her
satırın kanıt sütunu dolu olmak zorundadır ve pazarlama metinlerinde geçen her
ekran adı [feature-surface.snapshot.json](../../quality/feature-surface.snapshot.json)
içinde bulunmalıdır.

## Durum sözlüğü

| Durum | Anlamı | Kullanım izni |
| --- | --- | --- |
| `KANITLI` | Depoda çalıştırılabilir kanıt var (test, guard, kod) | Serbest |
| `KOŞULLU` | Kanıt var ama dış doğrulama (cihaz/sağlayıcı/mağaza) bekliyor | Yalnız koşullu dille |
| `ÖLÇÜLMEDİ` | Henüz ölçülmedi | Kullanılamaz; "henüz ölçmedik" denir |

## Kütük

| # | İddia | Hedef kitle | Dayandığı yüzey | Kanıt | İzin verilen ifade | Yasak abartı | Durum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Mekânları haritada görüp kendi listelerini oluşturabilirsin | Şehirde yeni yer arayan kullanıcı | `Map`, `ListDetail`, `Home` | `quality/feature-surface.snapshot.json` (10 kök rota, 4 sekme, 13 ekran) | "Haritada gez, beğendiğin mekânı listene ekle." | "Tüm mekânlar", "eksiksiz rehber" | KANITLI |
| C2 | Listeler ve mekânlar başka kullanıcılarla paylaşılabilir | Arkadaş grubuyla plan yapan kullanıcı | `ListDetail`, `UserProfile`, takip/beğeni/yorum yüzeyi | `docs/existing-feature-contract.md` "Mevcut kullanıcı kabiliyetleri" | "Listeni paylaş, arkadaşların da eklesin." | "Milyonlarca liste", "en popüler listeler" | KANITLI |
| C3 | Uygulamada reklam ve pazarlama takip SDK'sı yoktur | Gizliliğe duyarlı kullanıcı | Üretim bağımlılıkları | `package.json` üretim bağımlılıklarında reklam/analitik/attribution SDK'sı yok; yalnız `@sentry/react-native` (çökme raporu) | "Reklam yok, pazarlama takip SDK'sı yok. Yalnız çökme raporu var." | "Hiçbir veri toplamıyoruz" (yanlış: çökme raporu ve hesap verisi var) | KANITLI |
| C4 | Hesabını uygulama içinden silebilirsin | Çıkış yapmak isteyen kullanıcı | `Settings` hesap grubu | `supabase/functions/delete-user/` ve `handler.test.ts` | "Hesabını uygulamadan silebilirsin." | "Anında tamamen silinir" (silme akışı sunucu tarafında sıraya girer) | KANITLI |
| C5 | Rahatsız eden kullanıcıyı engelleyip içerik bildirebilirsin | Güvenlik kaygısı olan kullanıcı | `Settings` engellenenler, raporlama yüzeyi | `supabase/functions/moderation-reports/handler.test.ts`, `docs/moderation-without-admin-panel.md` | "Engelle ve bildir; engel tüm akışlarda geçerlidir." | "Zararlı içerik %100 engellenir" | KANITLI |
| C6 | Özel listeler ve özel hesap desteklenir | Mahremiyet isteyen kullanıcı | Gizlilik ayarları, RLS | `docs/existing-feature-contract.md`, Supabase RLS politikaları | "Listeni herkese açık ya da özel tutabilirsin." | "Askeri düzeyde şifreleme" | KANITLI |
| C7 | Metin okunabilirliği WCAG AA kontrast eşiğini karşılar | Erişilebilirlik ihtiyacı olan kullanıcı | Tüm ekranlar | `src/mobile/app/shared/theme/__tests__/tokens.test.ts`, `utils/guards/check-ui-tokens.mjs` | "Yazı renkleri WCAG AA kontrast eşiğinde tutulur." | "Tam erişilebilir" (ekran okuyucu cihaz kanıtı yok) | KANITLI |
| C8 | Dokunma hedefleri Android 48dp tabanını karşılar | Motor becerisi kısıtlı kullanıcı | Tüm kontroller | `utils/guards/` dokunma hedefi guard'ı | "Butonlar Android'in 48dp dokunma tabanına göre ölçülür." | "Herkes için kusursuz kullanım" | KANITLI |
| C9 | Çevrimdışıyken yazdıkların kaybolmaz, bağlantı gelince eşitlenir | Zayıf şebekedeki kullanıcı | Outbox | `src/mobile/app/data/outbox/`, `docs/offline-and-concurrency-contract.md` | "Bağlantın giderse işlemin sıraya alınır, dönünce gönderilir." | "Tam çevrimdışı çalışır" | KANITLI |
| C10 | Uygulama gerçek cihazlarda doğrulanmıştır | — | — | Yok | Kullanılamaz | "Test edildi", "kanıtlanmış performans" | ÖLÇÜLMEDİ |
| C11 | Kullanıcı sayısı / topluluk büyüklüğü | — | — | Yok | Kullanılamaz | "Binlerce kullanıcı", "büyüyen topluluk" | ÖLÇÜLMEDİ |
| C12 | Hız / performans rakamı | — | — | Cihaz ölçümü yok; `quality/release-scorecard.json` verdict `NO-GO` | Kullanılamaz | "Çok hızlı", "anında açılır", "%X daha hızlı" | ÖLÇÜLMEDİ |
| C13 | Mekân verisinin doğruluğu ve güncelliği | — | Kullanıcı üretimi içerik | Doğrulama mekanizması yok | Kullanılamaz | "Güncel", "doğrulanmış mekânlar", "gerçek zamanlı açık/kapalı" | ÖLÇÜLMEDİ |

## Kalıcı yasak listesi

Aşağıdakiler kanıt üretilse bile bu üründe kullanılmaz:

- "En iyi", "bir numara", "lider", "vazgeçilmez";
- "AI destekli", "akıllı algoritma" — böyle bir bileşen yok;
- "Garantili eşleşme", "kesin sonuç";
- Sahte kullanıcı yorumu, sahte puan, sahte katılımcı sayısı, sahte ekran görüntüsü;
- Sahte aciliyet ("son 3 saat", "yerler tükeniyor"), zorunlu davet, confirmshaming;
- Rakip marka adı üzerinden karşılaştırma.

## Doğrulama ritmi

Her yayın adayında: kütüğü aday commit'e karşı yeniden çalıştır, `ÖLÇÜLMEDİ`
satırlarından kanıt kazananları yükselt, kanıtı bayatlayanları düşür. Guard
kırmızıysa pazarlama materyali yayınlanmaz.
