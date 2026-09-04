# SoRita ekran görüntüsü ve önizleme storyboard'u

Tarih: 2026-09-04
Bağlı kütük: [claims-register.md](claims-register.md)

**Tek kural:** Buradaki her kare aday build'den alınır. Mockup içine olmayan
kontrol, olmayan rozet, uydurma sosyal sayı veya sahte kullanıcı çizilmez.
Bir kare çekilemiyorsa yayınlanmaz — yerine "temsilî görsel" konmaz.

## Neden ilk üç kare belirleyici

Mağaza listeleme sayfasında kullanıcıların çoğu kaydırmadan karar verir; ilk
üç kare pratikte tek şansımızdır. Bu yüzden üç kare **birbirini tekrar etmez**
ve her biri farklı bir kullanıcı işini gösterir. Sıra, ürünün kendi akışını
takip eder: önce mekânı bul, sonra karar ver, sonra paylaş.

## Kare planı

Cihaz sınıfı başına aynı 6 kare çekilir.

| # | Ekran (rota) | Kullanıcı işi | Başlık (max 45 karakter) | Kanıt |
| --- | --- | --- | --- | --- |
| 1 | `Map` | Çevredeki mekânları haritada görmek | `Mekânları haritada keşfet` | C1 |
| 2 | `LocationPlaceCards` veya mekân kartı | Bir mekânın detayına bakmak | `Mekânın fotoğrafını ve notunu gör` | C1 |
| 3 | `ListDetail` | Listeye eklemek / listeyi görmek | `Beğendiklerini listende topla` | C1, C2 |
| 4 | `Explore` | Liste, kişi, mekân aramak | `Liste, kişi ve mekân ara` | C1, C2 |
| 5 | `Home` veya `UserProfile` | Sosyal bağlamı görmek | `Kimin listesinde olduğunu gör` | C2 |
| 6 | `Settings` (gizlilik) | Kontrolü göstermek | `Reklam yok, kontrol sende` | C3, C4, C6 |

Kare 6 bilinçli olarak sonda: gizlilik bizim en savunulabilir ayrımımız ama
ilk kare olursa ürünün ne yaptığı anlaşılmaz.

## Başlık kuralları

- Başlık, karedeki ekranın **yapabildiği** şeyi söyler. Ekranda olmayan bir
  sonucu vaat etmez.
- En fazla 45 karakter; küçük telefonda okunur boyutta kalır.
- Cümle sonunda nokta yok, ünlem yok.
- Rakam yok (C11, C12, C13 gereği elimizde doğrulanmış rakam yok).

## Teknik özellikler

| Hedef | Ölçü | Not |
| --- | --- | --- |
| App Store 6.9" | 1320 × 2868 | Zorunlu set |
| App Store 6.5" | 1242 × 2688 | Zorunlu set |
| Play telefon | 1080 × 1920 (min 320, max 3840) | 2–8 görsel |
| Play feature graphic | 1024 × 500 | Metin güvenli alan: ortada 800 × 380 |
| Güvenli alan | Üst %12, alt %10 boş | Başlık cihaz çentiğine girmemeli |
| Tipografi | Başlık min 48 px @1320w | Küçük ekranda okunabilirlik |

Tablet görseli **üretilmez** — ürün telefon hedefli, iOS tablet desteği kapalı.

## İçerik kuralı: fixture

Aday build'de gerçek kullanıcı verisi yoksa sentetik fixture kullanılır ve:

- sosyal sayılar abartılmaz (beğeni/yorum sayıları tek haneli tutulur);
- uydurma marka/mekân adı kullanılmaz, jenerik ve gerçekçi adlar seçilir;
- sahte kullanıcı fotoğrafı yerine varsayılan avatar kullanılır;
- puan/yıldız gösterilmez (böyle doğrulanmış bir veri yok — C13).

## Önizleme videosu (opsiyonel, 15–30 sn)

Tek akış, kesintisiz ekran kaydı, ses yok, altyazı var:

1. (0–4 sn) Harita açılır, kullanıcı gezinir.
2. (4–10 sn) Mekân kartı açılır.
3. (10–18 sn) Mekân listeye eklenir.
4. (18–25 sn) Liste görünür, paylaşılır.
5. (25–30 sn) Kapanış: uygulama adı + "Sosyal harita ve mekân listesi".

Hızlandırma yapılabilir ama **gerçekte olmayan geçiş veya animasyon
eklenmez**. Yükleme durumu kesilecekse kesildiği belirtilir.

## Figma notu

Figma Design MCP bağlıysa kareler ayrı bir **"Marketing Assets"** sayfasında
düzenlenebilir frame olarak kurulur; üretim UI frame'lerine dokunulmaz. Figma
Make kullanılmaz. MCP yoksa bu belgedeki ölçüler ve export adları yeterlidir.

Export adları:

```
appstore_69_01_map.png
appstore_69_02_place.png
appstore_69_03_list.png
appstore_69_04_explore.png
appstore_69_05_social.png
appstore_69_06_privacy.png
play_phone_01_map.png   ... (aynı sıra)
play_feature_graphic.png
```

## Çekim öncesi kontrol

- [ ] Build, aday commit'ten üretildi ve SHA kaydedildi
- [ ] Cihaz saati/pil/şebeke çubuğu tutarlı (tek cihaz, tek oturum)
- [ ] Karelerde gerçek olmayan hiçbir kontrol yok
- [ ] Başlıklar 45 karakteri aşmıyor ve rakam içermiyor
- [ ] `npm run marketing:check` yeşil
