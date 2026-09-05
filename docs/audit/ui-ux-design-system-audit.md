# SoRita — tasarım sistemi ve erişilebilirlik denetimi

- Aday commit: `7f1a314b7e0ca42a5994e5341ac74f2932126bf0`
- Branch: `chore/final-release-candidate-aaa`
- Tarih: 2026-09-04
- Kapsam: Dondurulmuş ürün yüzeyi. Hiçbir ekran, rota, sekme, CTA veya bildirim
  türü eklenmedi/çıkarılmadı. `feature-surface:check` bu pasın başında ve
  sonunda aynı sonucu verdi: 10 kök rota, 4 sekme, 13 ekran girişi, 10 bildirim
  türü, 6 Edge Function, 18 ürün tablosu, 3 kova, 3 Ayarlar grubu, 19 CTA.

Bu belge bu pasta **ölçülerek** bulunan kusurları ve kapatılan boşlukları
kaydeder. Ölçülmemiş hiçbir iddia içermez.

## Yöntem

Kusurlar tahminle değil hesapla bulundu:

- Kontrast: WCAG 2.1 bağıl parlaklık formülü, her metin token'ı × uygulamanın
  boyadığı her opak yüzey.
- Dokunma hedefi: TSX ayrıştırılıp `Pressable` benzeri elemanların stil
  referansı çözüldü, boyutu ve `hitSlop`'u birlikte ölçüldü.
- Token bütünlüğü: palet blokları ayrıştırılıp aynı değeri taşıyan isimler ve
  hiçbir yerden okunmayan isimler çıkarıldı.

## Bulgular ve kapatılanlar

### B1 — Bilgi metni devre dışı token'ıyla boyanıyordu (P1, kapatıldı)

Mekân kartı zaman damgası ve pasif profil sekmesi sayaçları `textDisabled`
(`#94a3b8`) ile çiziliyordu: beyaz üzerinde **2,56:1**. Bunlar devre dışı
kontrol değil, canlı bilgidir; WCAG 1.4.3'ün devre dışı muafiyeti kapsamaz.

`textSoft`'a taşındılar. `textSoft` da `#64748b` → `#5a6a80` olarak
koyulaştırıldı: eski değer `surfaceMuted` üzerinde yalnız **4,34:1**
veriyordu, yenisi uygulamanın boyadığı **her** yüzeyde ≥4,5:1 tutuyor.

### B2 — 12px altı tipografi (P1, kapatıldı)

Keşfet karoları 10px ve 11px metin gönderiyordu. `check-ui-tokens` zaten elle
yazılmış stillerde 12px tabanını zorluyordu ama **token dosyasını atlıyordu**,
yani boyutu token olarak tanımlayarak taban aşılabiliyordu. Token'lar 12px'e
çıkarıldı ve guard artık tip ölçeğini de okuyor.

Ayrıca `display` token'ına 1px satır yüksekliği eklendi: 29/24 oranı Türkçe
ğ, ş ve noktalı İ için başlık boşluğu bırakmıyordu.

### B3 — 44dp altı ikon kontrolleri (P1, kapatıldı)

`hitSlop` taşımayan altı ikon kontrolü ölçüldü: liste düzenleyici kapatma
(30dp), harita arama temizleme (24dp), kapak temizleme (30dp), kaydetme
ilerleme menüsü (24dp), hızlı tepki butonları (30dp), mini harita odak kontrolü
(20dp). `hitSlopFor()` boyanmış kutudan gereken dolguyu türetiyor; görünen
tasarım değişmedi, yalnız görünmez dokunma alanı büyüdü.

### B4 — Aynı kararı tekrar eden ve okunmayan token'lar (P2, kapatıldı)

Kapak yer tutucusu dört ayrı isimde duruyordu (`profileCoverFallback`,
`ownProfileCover`, `publicProfileCover`, `userCoverFallback`) ve ilki
hiçbir yerden okunmuyordu. Tek `coverFallback` oldu.

`typography.micro`, `typography.caption` ile aynı 12px'i taşırken adıyla
daha küçük bir kademe vaat ediyordu; kaldırıldı.

Bu kontrolü guard'a eklemek iki tane daha buldu: `dangerBorderSubtle` ve
`successBorderSubtle` — tanımlı, hiç okunmuyor. Kaldırıldılar.

## Kapatılan guard boşlukları

| Guard | Önce | Sonra |
| --- | --- | --- |
| `check-ui-tokens` | Yalnız elle yazılmış stillerde renk ve 12px tabanı | Token dosyasının kendi tip ölçeğini de okur; okunmayan renk token'ında kırılır |
| `tokens.test.ts` | Elle seçilmiş 13 çift | Her okunabilir içerik rolü × her yüzey; durum çiftleri; dolu kontroller; 12px tabanı; 1,25 satır oranı |
| `check-marketing-claims` | Yoktu | Pazarlama metnindeki her ekran adını dondurulmuş yüzeyle karşılaştırır |

Her guard, kusuru **geri koyarak** doğrulandı; hiçbiri "eklendi" diye kabul
edilmedi.

## Kapatılmayan bulgular

Bunlar bilerek açık bırakıldı; sessizce geçilmedi.

### A1 — Kart dolgusu merkezîleşmemiş (P2)

Kart benzeri 35 stil girişinde dolgu 10, 12, 14, 16 ve 18 arasında dağılıyor;
18 yer ham `padding: 10` yazıyor ve `spacing.card = 10` token'ı kullanılmıyor.

Bilerek dokunulmadı: bu girişlerin hepsi kart değil (bir kısmı satır, modal,
hata ekranı), hepsini `spacing.card` yapmak yanlış anlam yükler. 14px'in ise
karşılığı olan bir token yok — gerçek sapma orada. Ölçek kararı verilmeden
yapılacak toplu ikame, kodu düzeltmeden yalnız daha dolambaçlı hâle getirir.

**Öneri:** Önce ölçek kararı (kart dolgusu kaç kademe olacak), sonra ikame.

### A2 — Boşluk ölçeği modüler değil (P2)

`spacing` = 0, 4, 6, 10, 12, 18, 24. 4pt ızgarasını 6, 10 ve 18'de kırıyor;
`radius` = 8, 11, 15, 20 benzer biçimde 11 ve 15'te. Bu görünür bir kusur
üretmiyor ama "aynı semantik rol aynı değeri alır" kuralını uygulanamaz
kılıyor.

Bilerek dokunulmadı: ölçeği düzeltmek her ekranın boşluğunu kaydırır ve bu,
istenmediği açıkça belirtilen köklü değişimdir.

### A3 — Cihaz kanıtı yok (P0, yayın engeli)

Kontrast ve dokunma hedefi statik olarak kanıtlandı; **gerçek cihazda ekran
okuyucu, font ölçeği ve dokunma doğrulaması yapılmadı**. VoiceOver/TalkBack
kanıtı olmadan erişilebilirlik "tamam" sayılamaz.
`quality/release-scorecard.json` verdict'i bu yüzden `NO-GO`.

## Değişmeyenler

- Ürün yüzeyi: aynı (guard doğruladı).
- Görsel tasarım: B1'deki kontrast düzeltmesi ve B2'deki 12px tabanı dışında
  hiçbir renk, boyut, boşluk veya yerleşim değişmedi.
- Yeni ekran, CTA, ayar, bildirim türü, tema veya dil: yok.
