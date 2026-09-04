# SoRita ölçüm planı

Tarih: 2026-09-04
Bağlı kütük: [claims-register.md](claims-register.md)

**Bu plan uygulamaya yeni bir kullanıcı özelliği veya analitik SDK'sı
eklemez.** C3 iddiası ("reklam ve pazarlama takip SDK'sı yok") ürünün en
savunulabilir ayrımıdır; onu ölçüm uğruna bozmak, kazanacağımız her şeyden
pahalıya gelir.

## Bugün elimizde ne var

| Kaynak | Ne veriyor | Sınırı |
| --- | --- | --- |
| App Store Connect | Gösterim, sayfa görüntüleme, kurulum, tutundurma | Kanal kırılımı kaba |
| Play Console | Aynı metrikler + kurulum kaynağı | Aynı |
| Sentry | Çökme, çökmesiz oturum oranı, sürüm bazlı hata | Ürün huni olayı yok |
| Supabase | Kayıt, liste/mekân oluşturma sayıları (sunucu tarafı) | Sorgu ile, PII'siz |

Bu dördü, aşağıdaki huninin tamamını **yeni bir istemci SDK'sı olmadan**
ölçmeye yeter.

## Ölçülecek huni

| Adım | Kaynak | Neden bu adım |
| --- | --- | --- |
| Gösterim → mağaza sayfası | Mağaza konsolu | Yaratıcı çalışıyor mu |
| Mağaza sayfası → kurulum | Mağaza konsolu | Metin/görsel ikna ediyor mu |
| Kurulum → kayıt tamamlama | Supabase (kullanıcı sayımı) | Onboarding kırılıyor mu |
| Kayıt → **ilk anlamlı eylem** | Supabase (ilk liste veya mekân) | Ürün değeri ulaştı mı |
| D1 / D7 tutundurma | Mağaza konsolu | Kanal kalitesi |
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
- Kullanıcı bazlı davranış akışı (event stream)

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

Ölçülmüş hiçbir kullanıcı metriği **yoktur**. C10, C11, C12, C13 satırları
`ÖLÇÜLMEDİ` durumundadır ve sunum/mağaza/reklam metinlerinde
kullanılmamaktadır. Sunumda traction slaytı "henüz ölçülmedi" der.
