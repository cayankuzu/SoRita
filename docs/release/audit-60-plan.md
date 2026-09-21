# 60 kategorilik denetim — faz planı

Hedef: **MOBİL UYGULAMA DENETİM MASTER PROMPTU v3.0** çalıştırıldığında her
kategori ≥9.8 alsın.

Çalışma şekli: oturum başına bir faz. Her fazın sonunda durum özeti, o fazda
9.8'e çıkan kategoriler, ve **Cayan'ın yapması gerekenler**. Onay gelmeden
sonraki faza geçilmez.

Son güncelleme: 2026-09-22.

---

## Önce iki puanlamayı ayıralım

Bunlar karıştırıldı, bir daha karışmasın:

| | 60 kategorilik denetim (**bu belge**) | 35 kategorilik `release-scorecard.json` |
|---|---|---|
| Kaynak | Denetim promptu v3.0 | Repo içi politika dosyası |
| Puanı kim verir | Claude, kanıta dayanarak | Guard'ın donmuş tablosu |
| 9.8 mümkün mü | **Evet**, kanıt üretilirse | Dosyada asla; yalnız imzalı CI makbuzunda |
| Bu planın hedefi | ✅ Bu | Ayrı iş, [path-to-9.8.md](./path-to-9.8.md) |

Önceki 9 fazlık liste ikincisi içindi. Asıl hedef bu belgedir.

## Kurallar bizi nasıl bağlıyor

Promptun kendi kuralları hedefi zorlaştırıyor, bunu baştan kabul ediyoruz:

- **K4** — kanıt görülmeden hiçbir kategori 8'in üstüne çıkamaz. Yani 9.8 için
  her kategoride somut, ölçülmüş kanıt gerekir.
- **K2** — materyal yoksa puan yok, ⬜ yazılır. ⬜ paydadan düşer ama "9.8 aldı"
  da sayılmaz.
- **Tavan kuralı** — tek bir P0 bulgusu genel puanı 6.0'a çakar. Yani önce bütün
  P0'lar sıfırlanacak.

## Envanter (PASS 0 ham verisi)

| | |
|---|---|
| Uygulama kodu | 438 dosya, 72.762 satır |
| Testler | 201 dosya, 37.659 satır |
| Edge Function | 20 dosya, 6.954 satır, 7 fonksiyon |
| Özellik modülü | 11 (auth, discovery, explore, home, lists, map, notifications, places, profile, settings, social) |
| Ekran | 14 |
| Migration | 75 |
| 300+ satır dosya | 74 · **500+ satır: 28** |
| En büyük 5 | `tr.ts` 1098, `usePlaceEditorState.ts` 929, `listsRepository.ts` 886, `optimisticSocialCache.ts` 872, `media.ts` 856 |

---

## Faz haritası

Prompt PASS 0–8 diyor; her PASS'ı "denetle → 9.8'e çıkar → kanıtla" olarak
genişletiyoruz.

### ⬜ Faz 0 — PASS 0 · Envanter ve erken uyarı
Puan verilmez. Envanter yukarıda; eksik materyal listesi ve ilk 3 tehlike
çıkarılır, sonra durulur.

### ⬜ Faz 1 — PASS 1 · Grup G + I · **12 kategori** · yayın engelleri
`G41` kimlik/oturum, `G42` sır saklama, `G43` taşıma güvenliği, `G44` istemci
sertleştirme, `G45` gizlilik/KVKK, `G46` kötüye kullanım,
`I55` App Store, `I56` Play Store, `I57` push/deeplink, `I58` yasal,
`I59` genel olgunluk, `I60` due diligence.

Önce bu grup, çünkü **tavan kuralı**: buradaki her P0 tüm raporu 6.0'a çakar.

- **Claude yapar:** token saklama denetimi, log sızıntısı taraması, ATS/cleartext,
  deeplink yetki testi, obfuscation doğrulaması, izin gerekçe metinleri,
  privacy manifest ↔ kod gerçeği karşılaştırması, hesap silme akışı doğrulaması.
- **Cayan gerekir:** canlı gizlilik politikası URL'i, Play Data Safety formu,
  App Store Connect erişimi, KVKK aydınlatma metni.
- **Kanıtsız 9.8 alamayacaklar:** `I55`, `I56`, `I58` (konsol/hukuki içerik),
  `G43` IDOR kısmı (canlı API'ye istek gerekir).

### ⬜ Faz 2 — PASS 2 · Grup A + B · **16 kategori** · ürün ve tasarım
`A1`–`A8` akış, `B9`–`B16` görsel dil.

- **Claude yapar:** 14 ekranın 6 durum matrisi (loading/empty/error/offline/
  partial/success), geri tuşu ve kesinti davranışı, form/klavye denetimi,
  mikrokopi taraması, token mimarisi, tip skalası, kontrast hesabı, spacing
  ızgarası, motion süreleri, B16'nın 16 maddelik premium cila listesi — cihazda
  ekran ekran doğrulanır.
- **Cayan gerekir:** yok. Bu faz tamamen bende.
- **Not:** Dark mode, i18n, RTL §3 gereği N/A.

### ⬜ Faz 3 — PASS 3 · Grup C + D · **9 kategori** · cihaz uyumu ve performans
`C17`–`C20` responsive/platform/a11y/dinamik tip, `D21`–`D25` performans.

- **Claude yapar:** Android genişlik sınıfları (360/393/411/480dp) emülatör +
  fiziksel cihazda; %200 font ölçeği; TalkBack ağacı; cold start ölçümü;
  `dumpsys gfxinfo` ile jank; `dumpsys meminfo` ile bellek; liste
  sanallaştırma denetimi; ağ çağrı sayısı ve N+1.
- **Cayan gerekir:** **iOS cihaz** (iPhone SE + güncel). Bu makine Windows,
  iOS simülatörü yok.
- **Kanıtsız 9.8 alamayacaklar:** `C17` iOS satırları, `C18` HIG, `C19`
  VoiceOver, `C20` iOS dinamik tip, `D21` iOS cold start.

### ⬜ Faz 4 — PASS 4 · Grup E · **9 kategori** · mimari ve kod kalitesi
`E26` katman disiplini, `E27` god class, `E28` DRY, `E29` KISS, `E30` hardcode,
`E31` isimlendirme, `E32` ölü kod, `E33` test edilebilirlik, `E34` genişleyebilirlik.

- **Claude yapar:** 28 adet 500+ satır dosyanın bölme planı ve uygulaması;
  hardcode sınıflandırması (güvenlik/ortam/tasarım/iş mantığı); tekrar eden
  kalıpların ortak bileşene taşınması; silinebilir dosya listesi;
  cyclomatic complexity noktaları; guard'larla kalıcılaştırma.
- **Cayan gerekir:** yok. Tamamen bende.
- **Not:** Bu fazın büyük kısmı zaten süren işin devamı (AppText, textStyle,
  useAutoDismissingNotice, dokunma hedefi guard'ı).

### ⬜ Faz 5 — PASS 5 · Grup F · **6 kategori** · veri, durum, ağ
`F35` state, `F36` ağ katmanı, `F37` çevrimdışı, `F38` senkronizasyon/idempotency,
`F39` medya pipeline, `F40` zaman/biçimlendirme.

- **Claude yapar:** race condition denetimi, 401 yenileme yarışı, retry/backoff,
  iptal, pagination tutarlılığı, uçak modu ekran matrisi, EXIF temizliği,
  idempotency anahtarları, UTC dönüşümü.
- **Cayan gerekir:** yok (yerel Supabase ile koşulabilir).

### ⬜ Faz 6 — PASS 6 · Grup H · **8 kategori** · altyapı ve operasyon
`H47` backend ölçek, `H48` hata dayanıklılığı, `H49` gözlemlenebilirlik,
`H50` analitik, `H51` CI/CD, `H52` sürüm/geri alma, `H53` bağımlılık/lisans,
`H54` belgeleme.

- **Claude yapar:** error boundary denetimi, crash raporlama entegrasyonu,
  bağımlılık/lisans taraması, CI pipeline incelemesi, OTA/rollback doğrulaması,
  README ve ADR kontrolü.
- **Cayan gerekir:** Sentry paneli, Supabase üretim metrikleri, PostHog erişimi.
- **Kanıtsız 9.8 alamayacaklar:** `H47`, `H49`, `H50`.

### ⬜ Faz 7 — PASS 7 · Grup J-Sosyal · **1 modül**
Feed sıralaması ve sayfalama tutarlılığı, takip modeli, beğeni sayacı,
gerçek zamanlılık, engelleme/sessize almanın feed'e yansıması, moderasyon ve
bildirme akışı (Apple 1.2 zorunluluğu).

- **Claude yapar:** hepsi.
- **Cayan gerekir:** yok.

### ⬜ Faz 8 — PASS 8 · Sentez
Tablo 1–4, sonuç raporu, 10/10 yol haritası, JSON özet. Puanlar bu fazda
kesinleşir.

---

## Dürüst tahmin

| | Kategori |
|---|---:|
| Claude tek başına 9.8'e çıkarabilir | **~47** |
| Cayan'ın erişim/donanım vermesi gerekir | ~13 |
| Toplam | 60 |

13'ün dağılımı: iOS donanımı (5), store konsolları (3), canlı backend/sağlayıcı
(4), hukuki içerik (1).

Yani **"tüm alanlar 9.8" yalnızca iOS cihaz + store konsol erişimi + canlı
sağlayıcı erişimi verilirse mümkün.** Bunlar olmadan o 13 kategori K2 gereği ⬜
kalır — uydurulmuş puan yazılmaz.

## Tik kuralı

Bir kategori yalnız şu üçü varsa 9.8 işaretlenir: ölçülmüş kanıt, kanıtın
dosya/satır veya cihaz çıktısı referansı, ve aynı commit'te yeşil kapılar.
"Kod yazıldı" tik değildir.
