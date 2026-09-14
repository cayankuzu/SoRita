# SoRita ölçüm planı

Tarih: 2026-09-14
Bağlı kütük: [claims-register.md](claims-register.md)

Bu plan reklam/attribution SDK'sı eklemez. Sentry hata ve performans
telemetrisini işler. PostHog ürün analitiği ise varsayılan olarak kapalıdır;
yalnız kullanıcının açık izni, geçerli yayın yapılandırması ve fail-closed uzak
kill-switch birlikte izin verdiğinde allowlist'teki anonim olayları işler.

## Bugün elimizde ne var

| Kaynak | Ne veriyor | Sınırı |
| --- | --- | --- |
| App Store Connect | Gösterim, sayfa görüntüleme, kurulum, tutundurma | Kanal kırılımı kaba |
| Play Console | Aynı metrikler + kurulum kaynağı | Aynı |
| Sentry | Çökme, performans izi, ekran/işlem adı ve düşük kardinaliteli ürün olayı metrikleri | Ham içerik analitiği değildir; etkinliği yayın yapılandırmasına bağlıdır |
| PostHog | İzinli anonim ekran/eylem hunileri, süreler ve tutundurma kohortları | Varsayılan kapalıdır; hesap kimliği, içerik, arama metni, medya URL'si, hassas konum ve session replay gönderilmez |
| Supabase | Kayıt, liste/mekân oluşturma sayıları (sunucu tarafı) | Sorgu ile, PII'siz |

PostHog etkinleştirilmeden mağaza, Supabase ve Sentry kaynakları temel sağlık
ve dönüşümü ölçer; kullanıcı açıkça izin verdiğinde PostHog ayrıntılı fakat
sınırlandırılmış ürün hunisini tamamlar.

## Ölçülecek huni

| Adım | Kaynak | Neden bu adım |
| --- | --- | --- |
| Gösterim → mağaza sayfası | Mağaza konsolu | Yaratıcı çalışıyor mu |
| Mağaza sayfası → kurulum | Mağaza konsolu | Metin/görsel ikna ediyor mu |
| Kurulum → kayıt tamamlama | Supabase (kullanıcı sayımı) | Onboarding kırılıyor mu |
| Kayıt → **ilk anlamlı eylem** | Supabase; izin varsa PostHog anonim olay hunisi | Ürün değeri ulaştı mı |
| Ekran/eylem terk noktaları | Yalnız izin varsa PostHog | Kullanıcı gereksiz eforla karşılaşıyor mu |
| D1 / D7 tutundurma | Mağaza konsolu; izin varsa PostHog anonim kohortu | Kanal ve ürün kalitesi |
| Çökmesiz oturum | Sentry | Kalite tavanı |

**İlk anlamlı eylem** = kullanıcının ilk listesini oluşturması **veya** ilk
mekân kartını eklemesi. Kurulum başarı sayılmaz.

## Sunucu tarafı sorgu ilkeleri

Sayımlar Supabase üzerinde toplu (aggregate) sorgularla alınır:

- Sonuçlar **birey değil, sayı** döner. Kullanıcı bazlı davranış tablosu
  tutulmaz.
- Sorgular ops tarafında çalıştırılır; uygulamaya telemetri kodu eklenmez.
- Çıktı dosyalarına e-posta, kullanıcı adı, konum, token veya medya URL'si
  yazılmaz.
- Küçük gruplarda tekilleştirme riski varsa sayı yuvarlanır veya raporlanmaz.

## Kesinlikle toplanmayacaklar

- Precise konum geçmişi
- Mesaj/yorum içeriği
- Erişim/yenileme token'ı, imzalı URL
- Reklam kimliği (IDFA/GAID)
- Cihaz parmak izi, üçüncü taraf attribution
- E-posta, kullanıcı adı, yorum/metin içeriği veya kesin konumu ürün olayı parametresi olarak gönderme

Sentry etkin olduğunda dahili kullanıcı kimliği hata ve teknik telemetriyle
ilişkilendirilebilir. Ürün olayı adaptörü kimlik, içerik ve medya URL'si
parametrelerini Sentry metriğine taşımaz; buna rağmen Sentry veri akışı mağaza
ve gizlilik beyanlarında açıkça belirtilir.

PostHog adaptörü hesap kimliğiyle `identify` çağırmaz, person profile ve session
replay kullanmaz, event özelliklerini kapalı bir allowlist ile yeniden kurar ve
SDK'nin otomatik yaşam döngüsü/push/error yakalamasını kapatır. Sağlayıcının
zorunlu anonim `distinct_id` değeri bir hesap kimliği değildir; yine de gizlilik
beyanlarında anonim kurulum tanımlayıcısı olarak açıkça belirtilir.

## Eşikler ve karar kuralları

Örneklem yetersizken **karar verilmez**. Bir kanal veya mağaza deneyi için
minimum: kol başına ≥1.000 mağaza sayfası görüntülemesi ve ≥7 gün.

| Sinyal | Eşik | Aksiyon |
| --- | --- | --- |
| Çökmesiz oturum | < %99,0 | Kampanya durdur, önce ürün düzelt |
| Kurulum → kayıt | < %40 | Onboarding incelenir (yeni ekran eklenmeden) |
| Kayıt → ilk eylem | < %30 | İçerik yoğunluğuna dönülür (GTM Aşama 0) |
| D7 | Kanal ortalamasının altında | Kanal durdurulur |

Eşikler **hedef değil, alarm** olarak kullanılır; bunlar sektör kıyası değil,
bu ürünün kendi baseline'ı oluştukça güncellenecek başlangıç değerleridir.

## Raporlama

Yayın sonrası haftalık, tek sayfa:

1. Huni (mutlak sayı + oran)
2. Kanal kırılımı
3. Çökmesiz oturum ve p95 hata
4. Kütükte durum değişen iddialar (`ÖLÇÜLMEDİ` → `KANITLI` yükselişleri)

Rapor kütüğü besler: bir metrik doğrulandığında ilgili `C#` satırı güncellenir
ve ancak o zaman pazarlama dilinde kullanılabilir.

## Şu anki dürüst durum

Ölçülmüş hiçbir kullanıcı metriği **yoktur**. PostHog sağlayıcı projesi, yayın
anahtarı, veri bölgesi, saklama süresi ve dashboard/alert kanıtı henüz dış
ortamda onaylanmamıştır. C10, C11, C12, C13 satırları `ÖLÇÜLMEDİ`
durumundadır ve sunum/mağaza/reklam metinlerinde kullanılmamaktadır. Sunumda
traction slaytı "henüz ölçülmedi" der.
