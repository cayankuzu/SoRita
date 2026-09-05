# SoRita reklam yaratıcı brief'leri

Tarih: 2026-09-04
Bağlı kütük: [claims-register.md](claims-register.md)

Üç açı. Hepsi doğrulanabilir; hiçbiri yeni özellik vaat etmez. Bütün
görseller gerçek ekran kaydından üretilir.

---

## Açı 1 — "Puan değil, kimin listesi"

**İçgörü:** 4,2 puan bir mekânın *senin için* doğru olduğunu söylemez. Zevkine
güvendiğin birinin listesinde olması söyler.

**Kanıt:** C1, C2 — liste oluşturma, paylaşma, takip, yorum yüzeyi mevcut.

### 6 saniyelik hook

> "Bu kafenin puanı 4,2. Peki senin zevkine uyuyor mu?"
> *(harita ekranı, mekân kartı açılıyor)*

### 15 saniyelik video akışı

| Saniye | Görsel | Altyazı |
| --- | --- | --- |
| 0–3 | Harita, mekânlar | "Puanlar birbirine benziyor." |
| 3–7 | Mekân kartı açılıyor | "Bu mekân kimin listesinde?" |
| 7–11 | Liste detayı, sahibi görünüyor | "Zevkine güvendiğin kişinin." |
| 11–15 | Listeye ekleme | "SoRita — sosyal harita ve mekân listesi." |

### Statik / carousel varyantı

3 kart: (1) harita, (2) mekân kartı, (3) liste. Her kart tek cümle taşır.

- **CTA:** "Haritayı aç"
- **Segment:** Şehirde yeni yer arayan
- **Kanal:** Instagram Reels, TikTok
- **Ölçülecek:** Thumb-stop oranı (3 sn), store view → install

---

## Açı 2 — "Ekran görüntüsü klasörün liste olsun"

**İçgörü:** İnsanlar gitmek istedikleri yerleri ekran görüntüsü olarak
biriktiriyor ve bir daha bulamıyor.

**Kanıt:** C1 — liste oluşturma, fotoğraf/not/konum ekleme mevcut.

### 6 saniyelik hook

> "Galerinde 40 tane mekân ekran görüntüsü var, değil mi?"
> *(telefon galerisi → uygulama listesi geçişi)*

### 15 saniyelik video akışı

| Saniye | Görsel | Altyazı |
| --- | --- | --- |
| 0–4 | Dağınık galeri | "Kaydettin ama bir daha bulamadın." |
| 4–9 | Liste oluşturma | "Listeni oluştur." |
| 9–13 | Mekân + fotoğraf + not ekleme | "Fotoğraf, not, konum — hepsi bir arada." |
| 13–15 | Liste görünümü | "SoRita." |

- **CTA:** "Listeni oluştur"
- **Segment:** Kendi seçkisini tutan
- **Kanal:** Instagram Stories, Reddit (şehir toplulukları)
- **Ölçülecek:** Install → ilk liste oluşturma (first-value action)

---

## Açı 3 — "Reklamsız olduğu için sana bir şey satmıyor"

**İçgörü:** Öneri uygulamalarına güvensizlik, çoğunlukla "sponsorlu mu?"
sorusundan geliyor.

**Kanıt:** C3 — üretim bağımlılıklarında reklam/analitik/attribution SDK'sı
yok; yalnız çökme raporu var. Bu, `package.json` üzerinden **dışarıdan
doğrulanabilir** bir iddiadır.

### 6 saniyelik hook

> "Bu listede sponsorlu mekân yok. Çünkü reklam sistemi yok."

### 15 saniyelik video akışı

| Saniye | Görsel | Altyazı |
| --- | --- | --- |
| 0–4 | Liste görünümü | "Sponsorlu yok." |
| 4–9 | Ayarlar / gizlilik | "Reklam SDK'sı yok, pazarlama takibi yok." |
| 9–13 | Hesap silme ekranı | "Hesabını uygulamadan silebilirsin." |
| 13–15 | Kapanış | "SoRita." |

- **CTA:** "Keşfet"
- **Segment:** Gizliliğe duyarlı kullanıcı
- **Kanal:** Reddit, Mastodon, gizlilik odaklı bültenler
- **Ölçülecek:** Store view → install oranı (bu açıda yüksek niyet beklenir)
- **Dikkat:** "Hiçbir veri toplamıyoruz" **denmez** — çökme raporu ve hesap
  verisi var. Cümle her zaman "reklam ve pazarlama takibi yok" biçiminde kurulur.

---

## Bütün açılar için yasaklar

- Sahte testimonial, sahte UGC, sahte yorum, sahte puan, sahte kullanıcı sayısı.
- Sahte aciliyet ("son gün", "yerler doluyor"), sayaç, FOMO dili.
- Yalnızlık/romantik yalnızlık sömürüsü.
- Rakip marka adı geçirmek veya ekranını göstermek.
- Hook'un vaat ettiği şeyin videoda gösterilmemesi (bait).
- Ekranda olmayan bir kontrolü mockup'a çizmek.

## Creator iş birliği

Creator ancak uygulamayı **gerçekten kullandıysa** "kişisel deneyim" dili
kurabilir. Kullanmadıysa metin ürün tanıtımı olarak yazılır ve iş birliği
etiketlenir. Senaryo creator'a dayatılmaz; yukarıdaki yasaklar sözleşmeye
yazılır.

## Bütçesiz dağıtım alternatifi

Ücretli bütçe yoksa aynı üç açı organik olarak çalışır:

1. Şehir/mekân odaklı mikro içerik üreticileriyle liste paylaşımı.
2. Üniversite ve mahalle topluluklarında gerçek liste paylaşımı (reklam değil,
   içerik).
3. "Şu semtte 8 kahveci" gibi somut listelerin ekran kaydıyla paylaşılması.

Hiçbirinde sahte hesap, sahte etkileşim veya toplu yorum kullanılmaz.
