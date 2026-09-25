# Changelog

Tum onemli degisiklikler bu dosyada belgelenir.

Format [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ve
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) kurallarini takip eder.

## [Yayinlanmamis] - Eylul 2026 (OTA 1.0.108 runtime, native 1.0.110 paketi hazir)

Eylul 2026'daki guncellemeler kablosuz (EAS Update) teslim edildi; ayrintili
kayit `docs/release/audit-60-checklist.md` icinde.

### Eklenen
- Kesfet ve profil icerigi uc sutunlu izgarada; karoya dokununca akis o kartta acilir
- Kesfet aramasi alaka sirasina gore: takip edilenler once, kendi icerigin arama sonucunda yok
- Harita aramasi haritanin baktigi yere yakin sonuclari once getirir
- Uygulama acikken gelen bildirim uygulama ici bant olarak gorunur; bildirim ayar yardimi
- Buyutulen fotograflarda iki parmakla yakinlastirma, kaydirma, cift dokunma
- Herkese acik liste paylasimi; yer paylasim baglantilari tiklanabilir web adresi
- Ayarlar'da "Yasal" grubu: Kullanim Kosullari, Topluluk Kurallari, Gizlilik Politikasi, KVKK
- Ayarlar'da yuklu surum etiketi

### Degistirilen
- Yorumlar zincir halinde (YouTube/Reddit duzeni), gercek begeni sayilariyla
- Takibi birakma once onay soruyor; buton "Takiptesin" durumunu gosteriyor
- Liste sayfasi ve duzenleyicilerde tekrar eden bilgiler kaldirildi
- Hata raporlari loglarla ayni temizligi goruyor (e-posta, oturum anahtari, imzali adres gonderilmez)
- Android geri tusu once acik menuyu kapatiyor

### Duzeltilen
- Kucultulup yeniden acilan yer taslagi sorusuz kapanip kayboluyordu
- Harita kontrolleri Google logosunu ortuyordu
- Kaydedilen satir sonlari kutu olarak gorunuyordu
- Listelerde kirpma degisince sayfalarin bosalmasi ve cokme
- Bildirimden acilan yerin gorunur konuma gelmemesi ve yorumlarin acilmamasi

### Native paket (native/faz-4, 1.0.110 (116); Play yuklemesi bekliyor)
- Tek acilis ekrani, dikey kilit, tema ikonu
- Bildirim cubugunda beyaz kare yerine SoRita isareti

## [1.0.51] - 2026-06-27

### Eklenen
- Erisilebirlik (A11y): Tum interaktif bilesenlere accessibilityLabel ve accessibilityRole eklendi
- Skeleton screen bilesenleri (PlaceCardSkeleton, ListGridTileSkeleton, ProfileSkeleton)
- Cevrimdisi durum gostergesi (OfflineIndicator)
- Haptic feedback altyapisi (useHaptic hook)
- Analytics abstraction layer (analyticsEvents.ts)
- Reduce motion destegi (useReduceMotion hook)
- iOS Privacy Manifest (privacyManifests) eklendi
- CI/CD: GitHub Actions workflow (lint, typecheck, test, build)
- README.md kapsamli belgeleme

### Degistirilen
- Dokunma hedefleri 44x44pt minimumuna yukseltildi (WCAG 2.1 uyumu)
- HomeScreen yuklenme durumu ActivityIndicator yerine skeleton screen kullanir
- Hardcoded renkler tokens.ts'e tasinarak merkezilestrildi
- Magic number'lar (retry, timeout, page size) constants dosyasina cikarildi
- uniqueStrings(), getFunctionUrl() tekrar eden fonksiyonlar ortak util'e tasindi
- Silent .catch bloklarina debug log eklendi
- Inline Turkce metinler tr.ts'e tasindi

### Duzeltilen
- TypeScript strict mode uyumu icin tum tip hatalari giderildi
- FeedActionBar accessibilityState (selected/expanded) eklendi
- CommentThread like/reply butonlarinin a11y etiketleri eklendi

## [1.0.49] - 2026-06-22

### Eklenen
- Olceklenebilirlik indeksleri ve RPC fonksiyonlari (SQL migration)
- Guvenlik sertlestirme ve yayin dosyalari

## [1.0.0] - 2026-06-01

### Eklenen
- Ilk proje yayin surumu
- Harita tabanli sosyal mekan kesfetme
- Kullanici kayit/giris (Supabase Auth)
- Liste olusturma, mekan ekleme, yorum ve begeni sistemi
- Takip/takipci sistemi
- Kesfet ekrani (listeler, mekanlar, fotograflar, kullanicilar)
- Push bildirimleri (FCM/APNs)
- HMAC request signing guvenlik katmani
- Icerik moderasyonu
