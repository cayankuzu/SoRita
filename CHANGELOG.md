# Changelog

Tum onemli degisiklikler bu dosyada belgelenir.

Format [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ve
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) kurallarini takip eder.

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
