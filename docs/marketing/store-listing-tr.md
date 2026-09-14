# SoRita mağaza metinleri (TR)

Tarih: 2026-09-04
Uygulama adı: **SoRita** (değiştirilmiyor — marka kararı yok)
Paket: `com.cayan.sorita.socialmap` · Sürüm: `1.0.106`
Dil: Yalnız Türkçe. Yeni dil bu kapsamda yok.
Bağlı kütük: [claims-register.md](claims-register.md)

Bütün metinler `KANITLI` iddialara dayanır. `ÖLÇÜLMEDİ` satırlarından tek
kelime kullanılmamıştır — bu yüzden metinde kullanıcı sayısı, hız rakamı,
"en iyi mekânlar" veya "doğrulanmış" gibi bir ifade yoktur.

## App Store

### Ad (30 karakter sınırı)

```
SoRita
```

### Alt başlık (30 karakter sınırı)

```
Sosyal harita ve mekân listesi
```
29 karakter. Uygulamanın kendi giriş ekranı dilinden ("Sosyal haritanı
oluştur") türetildi.

### Promotional text (170 karakter — inceleme gerektirmeden değişir)

```
Beğendiğin mekânları haritada işaretle, listelerine ekle ve arkadaşlarınla
paylaş. Reklam/attribution SDK'sı yok; ürün analitiği isteğe bağlıdır.
```

### Açıklama (ilk üç satır ekranda görünür)

```
Mekânları yalnız haritada değil, insanların oluşturduğu listelerle keşfet.
Beğendiğin yeri listene ekle, notunu ve fotoğrafını koy.
Listeni paylaş; arkadaşların takip etsin, yorum yazsın.

NASIL ÇALIŞIR
• Harita — Çevrendeki mekânları haritada gez, mekân kartını aç.
• Keşfet — Mekân, liste, kişi ve fotoğraf ara.
• Listeler — Kendi listeni oluştur; fotoğraf, video, not, konum ve menü
  bağlantısı ekle.
• Profil — Listelerini ve mekânlarını tek yerde topla.

SOSYAL BAĞLAM
Takip et, beğen, yorum yaz ve yanıtla. Bir mekânın kimin listesinde olduğunu
görmek, puan ortalamasından daha çok şey anlatır.

GİZLİLİK VE KONTROL
• Reklam ve sponsorlu yerleştirme yok. Attribution SDK'sı yok. Sentry teknik
  telemetri için kullanılabilir; anonim ürün analitiği varsayılan olarak kapalı
  ve isteğe bağlıdır.
• Listelerini herkese açık ya da özel tutabilirsin; hesabını gizli yapabilirsin.
• Rahatsız eden kullanıcıyı engelleyebilir, içeriği bildirebilirsin.
• Hesabını uygulama içinden silebilirsin.

SoRita kullanıcıların oluşturduğu içerikle çalışır. Mekân bilgileri
kullanıcılar tarafından eklenir; açık/kapalı durumu veya güncellik garantisi
vermez.
```

Son paragraf bilinçli olarak konur: C13 gereği doğruluk iddiası yapamıyoruz,
o yüzden sınırı açıkça yazıyoruz. Bu hem dürüstlük hem de mağaza reddi riskini
düşürür.

### Anahtar kelimeler (100 karakter, virgülle)

```
mekan,harita,liste,keşfet,kafe,restoran,gezi,şehir,öneri,sosyal,rehber,kaydet
```

Rakip marka adı yok, tekrar yok, açıklamada geçen kelimeler tekrarlanmadı
(App Store başlık/alt başlıktaki kelimeleri zaten indeksler).

## Google Play

### Kısa açıklama (80 karakter)

```
Mekânları haritada keşfet, listene ekle, arkadaşlarınla paylaş.
```
62 karakter.

### Uzun açıklama

App Store açıklamasıyla aynı gövde kullanılır; Play'de madde işaretleri
korunur. Play uzun açıklamada anahtar kelime yoğunluğu sinyaldir ama
**keyword stuffing yapılmaz**: "mekân" ve "liste" doğal akışta zaten geçiyor.

## Veri güvenliği / gizlilik beyanı

Beyan gerçek veri akışıyla eşleşmek zorundadır. Doğrulanan durum:

| Alan | Beyan | Dayanak |
| --- | --- | --- |
| Reklam kimliği | Toplanmıyor | Üretim bağımlılıklarında reklam SDK'sı yok (C3) |
| Attribution / reklam verisi | Toplanmıyor | Reklam ve attribution SDK'sı yok (C3) |
| Uygulama etkileşimi / performans | Sentry etkinse teknik ölçümler; ayrıca yalnız açık kullanıcı izni, yayın anahtarı ve uzaktan kill-switch onayı varsa PostHog ile sınırlı anonim ürün olayları toplanabilir | Düşük kardinaliteli olay, ekran/işlem adı ve süre/sayaç metrikleri (C3) |
| Çökme ve tanılama verisi | Sentry etkinse toplanabilir | `@sentry/react-native`, performans izi ve hata raporu (C3) |
| Hesap tanımlayıcı | Sentry etkinse dahili kullanıcı kimliğiyle ilişkilendirilebilir | `AuthSessionProvider.tsx` içindeki `Sentry.setUser` (C3) |
| Konum | Toplanıyor (uygulama işlevi) | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` |
| Fotoğraf/video | Toplanıyor (kullanıcı içeriği) | `CAMERA`, medya seçici |
| Kişisel bilgi | E-posta, kullanıcı adı, profil | Supabase Auth |
| Silme | Uygulama içinden hesap silme var | `delete-user` Edge Function (C4) |
| Şifreleme | Aktarımda TLS | Supabase/HTTPS |

**Yapılmayacak:** "Hiçbir veri toplanmıyor" veya "analitik toplanmıyor"
kutusunu işaretlemek. Nihai App Store Privacy / Play Data Safety cevapları,
yayın yapılandırmasındaki Sentry/PostHog ayarları, kullanıcı izni ve sağlayıcı sözleşmeleriyle ayrıca
doğrulanmalıdır; yanlış beyan mağaza yaptırımı sebebidir.

## İçerik derecelendirmesi notu

Kullanıcı üretimi içerik (UGC) vardır: liste, mekân kartı, fotoğraf, yorum.
Bu yüzden engelleme ve bildirme akışları (C5) formda **açıkça** beyan edilir;
Apple UGC şartı bunu ister.

## Yayın öncesi kontrol

- [ ] Ekran görüntüleri aday build'den alındı ([screenshot-storyboard.md](screenshot-storyboard.md))
- [ ] Metindeki her cümle bir `KANITLI` kütük satırına bağlı
- [ ] `ÖLÇÜLMEDİ` satırlarından hiçbir ifade kullanılmadı
- [ ] Veri güvenliği formu yukarıdaki tabloyla birebir aynı
- [ ] `npm run marketing:check` yeşil
