# SoRita pazara çıkış ve kanal planı

Tarih: 2026-09-04
Bağlı kütük: [claims-register.md](claims-register.md)

Bu plan yeni ürün yüzeyi gerektirmez. Uygulamaya tek satır kod eklemeden
uygulanabilir; ölçüm tarafı [measurement-plan.md](measurement-plan.md)
belgesindedir.

## Başlangıç gerçeği

- Kullanıcı tabanı: **sıfır varsayılır**. Elimizde ölçüm yok (C11).
- Ürün: Türkçe, telefon, tek şehirde bile anlamlı çalışır.
- Bütçe varsayımı: küçük veya sıfır. Plan buna göre organik ağırlıklıdır.
- Yayın durumu: `quality/release-scorecard.json` verdict **NO-GO**. Pazarlama
  hazırlığı yapılır, **yayın tetiklenmez**.

Bir keşif uygulamasının ilk problemi kullanıcı sayısı değil, **içerik
yoğunluğudur**. Boş harita hiçbir mesajla kurtarılmaz. Bu yüzden plan
coğrafi olarak dar başlar.

## Aşama 0 — Tek şehir, tek semt yoğunluğu (yayın öncesi)

Hedef: uygulamayı açan ilk kişinin boş ekran görmemesi.

- Tek bir şehir, tercihen 2–3 semt seçilir.
- Kurucu ve yakın çevre, o semtlerde gerçek listeler oluşturur (uydurma mekân
  değil; gerçekten gidilmiş yerler).
- Ölçüt: seçilen semtte kullanıcının haritayı açtığında **en az bir liste**
  görmesi.

Bu aşama pazarlama değil, ürün hazırlığıdır. Atlanırsa diğer bütün aşamalar
boşa gider.

## Aşama 1 — Mağaza araması (sürekli)

En ucuz ve en yüksek niyetli kanal. Gereken tek şey doğru metin ve görsel:
[store-listing-tr.md](store-listing-tr.md), [screenshot-storyboard.md](screenshot-storyboard.md).

- Anahtar kelimeler mekân/liste/keşif ekseninde; rakip marka yok.
- İlk üç kare farklı işler anlatır.
- Ölçüt: store view → install oranı.

## Aşama 2 — Yerel içerik üreticileri (mikro ölçek)

- 5.000–50.000 takipçili, **şehir/mekân** odaklı üreticiler.
- Teklif: kendi seçkisini SoRita listesi olarak yayınlaması.
- Ücret yerine önce karşılıklı değer denenir (liste kalıcı bir portfolyo).
- Sahte "kişisel deneyim" dili yok (bkz. ad-creative-briefs.md).
- Ölçüt: kanal başına install ve **ilk liste oluşturma** oranı.

## Aşama 3 — Topluluklar

- Üniversite toplulukları, semt/mahalle grupları, şehir subreddit'leri.
- Format: reklam değil, **gerçek liste paylaşımı** ("Kadıköy'de çalışılabilecek
  8 kahveci" gibi somut, faydalı içerik).
- Topluluk kurallarına uyulur; spam yapılmaz, çoklu hesap kullanılmaz.
- Ölçüt: D1/D7 tutundurma (bu kanalın kalitesi burada görünür).

## Aşama 4 — Ücretli test (yalnız bütçe varsa)

- Küçük, kontrollü kohort. Tek değişken.
- Yeterli örneklem yoksa **karar verilmez** — "kazandı" denmez.
- Install artışı tutundurmayı bozuyorsa kampanya durdurulur; ucuz install
  hedefi kaliteyi bozarsa vazgeçilir.

## Huni ve kanal isimlendirme

Ölçülecek huni:

```
gösterim → mağaza sayfası → kurulum → kayıt tamamlama
        → ilk anlamlı eylem (ilk liste veya ilk mekân ekleme)
        → D1 → D7
```

"İlk anlamlı eylem" bilinçli olarak **ilk liste/mekân eklemedir**, kurulum
değil. Kurulum bir metrik değil, bir başlangıçtır.

UTM / kampanya adlandırma:

```
sorita_<kanal>_<acisi>_<tarih>
örnek: sorita_reddit_privacy_202609
```

Attribution gizlilik-güvenlidir: parmak izi çıkarma, cihaz kimliği eşleme veya
üçüncü taraf attribution SDK'sı **eklenmez** (C3'ü bozar). Kanal kırılımı
mağaza konsollarının kendi raporlarından ve kampanya bazlı store linklerinden
okunur.

## Karar kuralları

| Durum | Karar |
| --- | --- |
| Örneklem yetersiz | Karar yok. Beklenir. |
| Install arttı, D7 düştü | Kanal durdurulur. Kalite install'dan önemlidir. |
| Store view yüksek, install düşük | Sorun mağaza sayfasında; görsel/metin testi. |
| Install yüksek, ilk eylem düşük | Sorun ilk deneyimde; içerik yoğunluğuna dönülür. |
| Çökme oranı yükseldi | Kampanya durdurulur, ürün önce düzeltilir. |

Son satır bağlayıcıdır: kampanya ölçümü uygulama kararlılığı veya gizliliği
pahasına yapılmaz.

## Mağaza deneyleri

- Baseline dönüşüm ve minimum trafik yoksa **deney başlatılmaz**.
- Bir testte tek hipotez / tek asset ailesi.
- Yalnız App Store Product Page Optimization ve Play store-listing testleri
  kullanılır — **uygulama içine A/B veya feature-flag sistemi eklenmez**.
- Kazanan yalnız güven eşiği *ve* aşağı huni kalitesi birlikte iyileştiyse
  uygulanır.
