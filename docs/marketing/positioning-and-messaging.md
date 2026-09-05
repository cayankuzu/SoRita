# SoRita konumlandırma ve mesaj hiyerarşisi

Tarih: 2026-09-04
Bağlı kütük: [claims-register.md](claims-register.md)

Bu belge yeni özellik tarif etmez. Uygulamanın halihazırda yaptığı işi daha
anlaşılır anlatmak için yazılmıştır. Her cümlenin arkasında bir `C#` kütük
satırı vardır.

## Ürünün tek cümlesi

> Mekânları yalnız haritada değil, insanların oluşturduğu listelerle keşfet.

Uygulamanın kendi sesi zaten bu: giriş ekranı **"Sosyal haritanı oluştur,
mekânlarını paylaş"**, Keşfet sekmesi **"Yeni mekânlar ve listeler keşfet"**
diyor. Pazarlama dili bu iki cümleden türetilir; yeni bir marka dili icat
edilmez.

## Neden bu konumlandırma

Harita uygulamaları "nerede" sorusunu çözüyor, ama "hangisi bana göre"
sorusunu çözmüyor. Bir mekânın 4,2 puanı, o mekânın *senin için* doğru olup
olmadığını söylemez. SoRita'nın mevcut yüzeyi tam bu boşlukta duruyor: puan
değil, **kimin listesinde olduğu**.

Bu bir pazar iddiası değil, üründeki mevcut yüzeyin okunuşudur: liste oluşturma,
liste paylaşma, takip, beğeni ve yorum zaten var (C1, C2).

## Segmentler ve JTBD

Segmentler kod ve mevcut copy'den türetildi; anket verisi yok, o yüzden
"varsayılan segment" olarak işaretlidir ve ölçümle doğrulanana kadar öyle kalır.

### 1. Şehirde yeni yer arayan (birincil)

- **Durum:** Bu akşam gidilecek yer aranıyor, harita listesi çok kalabalık.
- **Engel:** Puanlar birbirine benziyor, hangisinin gerçek olduğu belirsiz.
- **Mevcut çözüm:** Harita sekmesinde gez, mekân kartını aç, birinin listesinde
  gör (C1).
- **İlk anlamlı değer anı:** İlk mekânı bir listeye eklemek.

### 2. Kendi seçkisini tutan (birincil)

- **Durum:** Gittiği yerleri bir yerde biriktirmek istiyor.
- **Engel:** Not uygulaması dağınık, ekran görüntüsü klasörü aranabilir değil.
- **Mevcut çözüm:** Liste oluştur, mekân kartı ekle, fotoğraf/not/konum koy (C1).
- **İlk anlamlı değer anı:** İlk listeyi tamamlamak.

### 3. Arkadaş grubuna öneri veren (ikincil)

- **Durum:** "Nereye gidelim" sorusuna sürekli aynı cevapları yazıyor.
- **Engel:** Öneriyi tekrar tekrar anlatmak.
- **Mevcut çözüm:** Listeyi paylaş, arkadaşlar takip etsin, yorum yazsın (C2).
- **İlk anlamlı değer anı:** Listesinin başkası tarafından açılması.

## Mesaj hiyerarşisi

**Ana vaat:** Mekânları insanların listeleriyle keşfet.

**Üç destek:**

1. **Haritada keşif** — Harita sekmesi, mekân kartı, konuma bağlı kartlar (C1).
2. **Karar veren listeler** — Liste oluşturma, düzenleme, detay (C1, C2).
3. **Sosyal bağlam** — Takip, beğeni, yorum, profil (C2).

**Güven mesajı:** Reklam yok, pazarlama takip SDK'sı yok; hesabını
uygulamadan silebilirsin (C3, C4). Bu, ürünün en savunulabilir ayrımıdır çünkü
bağımlılık listesinden doğrulanabilir.

**CTA dili:** "Haritayı aç", "Listeni oluştur", "Keşfet". Emir kipi kısa
tutulur; aciliyet dili kullanılmaz.

## Marka sesi

- Sade, samimi, ikinci tekil şahıs ("keşfet", "listeni oluştur") — uygulamanın
  içindeki dille aynı.
- Süslü sıfat yok. "Muhteşem", "devrim", "eşsiz" kullanılmaz.
- Türkçe doğru: diakritikler tam ("mekân", "keşfet"), İngilizce karışım yok.
- Mekân sayısı, kullanıcı sayısı, puan gibi rakamlar **ölçülene kadar
  kullanılmaz** (C11, C13).

## Söylemeyeceklerimiz

| Cazip ama yasak | Neden |
| --- | --- |
| "Şehrin en iyi mekânları" | Kalite iddiası; doğrulama mekanizması yok (C13) |
| "Binlerce kullanıcı" | Ölçülmedi (C11) |
| "Yapay zekâ önerileri" | Böyle bir bileşen yok |
| "Gerçek zamanlı açık/kapalı" | Böyle bir veri akışı yok (C13) |
| "Tamamen anonim" | Hesap ve çökme raporu var (C3) |
