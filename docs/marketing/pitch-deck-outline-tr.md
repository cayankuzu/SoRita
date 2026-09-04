# SoRita sunum iskeleti (TR)

Tarih: 2026-09-04
Bağlı kütük: [claims-register.md](claims-register.md)
Biçim: 10 slayt. Her slayt **tek mesaj**, bol beyaz alan, gerçek ekran görüntüsü.

Tasarım kuralı: slayt başına en fazla bir başlık + üç madde + bir görsel.
Metin slaytı doldurmaz; konuşan anlatır. Bütün ekran görüntüleri aday
build'den gelir ([screenshot-storyboard.md](screenshot-storyboard.md)).

---

### 1 — Problem

**Mesaj:** Nereye gideceğine karar vermek, yer bulmaktan zor.

- Harita "nerede" sorusunu çözdü, "hangisi bana göre" sorusunu çözmedi.
- Puan ortalaması kişisel zevki temsil etmiyor.
- İnsanlar önerileri ekran görüntüsü olarak biriktirip kaybediyor.

*Görsel:* Dağınık ekran görüntüsü galerisi.
*Not:* Pazar büyüklüğü rakamı **yok** — elimizde doğrulanmış veri yok.

---

### 2 — Hedef kullanıcı ve durum

**Mesaj:** Şehirde yer arayan ve kendi seçkisini tutan kişi.

- Şehirde yeni yer arayan
- Kendi seçkisini biriktiren
- Arkadaş grubuna sürekli öneri veren

*Not:* Segmentler üründen ve mevcut copy'den türetildi; anket verisi yok.
Bu slaytta "varsayım" olduğu açıkça söylenir.

---

### 3 — Ürünün mevcut çözümü

**Mesaj:** Mekânları insanların listeleriyle keşfet.

- Harita → mekân kartı → liste
- Liste oluştur, paylaş, takip et
- Yorum ve beğeni ile sosyal bağlam

*Görsel:* Harita + liste ekranı yan yana. (C1, C2)

---

### 4 — Gerçek kullanıcı yolculuğu

**Mesaj:** Kurulumdan ilk değere dört adım.

Haritayı aç → mekânı gör → listene ekle → paylaş

*Görsel:* Dört gerçek ekran görüntüsü, tek sırada.
*Not:* Bu akış uygulamada bugün çalışıyor; prototip değil.

---

### 5 — Farklılaştırıcı

**Mesaj:** Puan değil, kimin listesi.

- Sosyal bağlam ürünün merkezinde, eklenti değil (C2)
- Reklam ve pazarlama takip SDK'sı yok — bağımlılık listesinden doğrulanabilir (C3)
- Sponsorlu yerleştirme yok, çünkü reklam sistemi yok

*Not:* Rakip adı geçirilmez, karşılaştırma tablosu yapılmaz.

---

### 6 — Güvenlik, mahremiyet ve teknik kalite

**Mesaj:** Kontrol kullanıcıda, kalite ölçülebilir.

- Supabase Auth + satır düzeyi güvenlik (RLS), özel depolama
- Uygulama içinden hesap silme (C4), engelleme ve bildirme (C5)
- Erişilebilirlik: WCAG AA kontrast eşiği ve 48dp dokunma tabanı, guard'larla
  sürekli doğrulanıyor (C7, C8)
- Ürün yüzeyi donduruldu: 10 rota, 4 sekme, 13 ekran — makine ile denetleniyor

*Görsel:* Yeşil guard çıktısı ekran görüntüsü (gerçek terminal çıktısı).

---

### 7 — Traction

**Mesaj:** **Henüz ölçülmedi.**

- Kullanıcı metriği yok (C11)
- Performans rakamı yok (C12)
- Yayın durumu: cihaz/sağlayıcı/mağaza kanıtı tamamlanmadan **NO-GO**

*Not:* Bu slayt bilinçli olarak boş bırakılmaz ve süslenmez. Sahte traction
göstermek, yatırımcı görüşmesinde kaybedilecek en pahalı şeydir. Bunun yerine
[measurement-plan.md](measurement-plan.md) planı gösterilir.

---

### 8 — Pazara çıkış

**Mesaj:** Dar başla, yoğunluk kur, sonra büyüt.

- Tek şehir / 2–3 semtte içerik yoğunluğu
- Mağaza araması + yerel mikro üreticiler + topluluklar
- Ücretli kanal yalnız bütçe ve baseline varsa

*Kaynak:* [go-to-market-plan.md](go-to-market-plan.md)

---

### 9 — İş modeli

**Mesaj:** Henüz tanımlı bir gelir modeli yok.

Depoda abonelik, premium, reklam ürünü veya ödeme entegrasyonu **yoktur**.
Bu slayt bunu açıkça söyler ve uydurma bir model sunmaz. Reklamsızlık bugün
bir ürün kararıdır (C3); gelecekteki modelin ne olacağı bu sunumun konusu
değildir.

---

### 10 — Sonraki adım

**Mesaj:** Kanıtı tamamla, sonra yayınla.

- İmzalı build üzerinde cihaz doğrulaması
- Sağlayıcı (Cloudflare/Supabase/mağaza) kanıtlarının aynı commit'e bağlanması
- İlk şehir yoğunluğu ve ilk ölçüm turu

*Not:* Yeni özellik yol haritası **sunulmaz**. Vaat edilen her özellik, henüz
yayınlanmamış bir üründe borçtur.

---

## Düzenlenebilir kaynak

Slaytlar 16:9, tek tipografi ailesi, iki renk (metin + vurgu). Uygulamanın
kendi paleti kullanılır: vurgu `#2563eb`, metin `#0f172a`, zemin `#ffffff`.
Kaynak dosya `docs/marketing/assets/` altında tutulur ve bu iskeletle
senkron kalır.

## Sunum yasakları

- Uydurma pazar büyüklüğü, gelir projeksiyonu, kullanıcı sayısı
- Sahte testimonial veya logo duvarı
- Olmayan özelliğin mockup'ı
- "En iyi", "lider", "devrim" dili
