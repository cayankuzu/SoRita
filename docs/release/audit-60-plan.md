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

### 🔶 Faz 1 — PASS 1 · Grup G + I · **12 kategori** · yayın engelleri — TARANDI

**Sonuç: P0 yayın engeli 0 adet.** Tavan kuralı uygulanmadı.

| # | Kategori | Puan | Not |
|---|---|---|---|
| G41 | Kimlik doğrulama & oturum | 9.5 | canlı API testi eksik |
| G42 | Sır & veri saklama | 9.5 | örnek seviyede, aşağıya bkz. |
| G43 | Taşıma güvenliği | 8.5 | IDOR test edilmedi |
| G44 | İstemci sertleştirme | 9.5 | minify+shrink+proguard açık |
| G45 | Gizlilik & KVKK | ⬜ | konsol gerekli |
| G46 | Kötüye kullanım | 9.0 | bildir+engelle+rate limit var |
| I55 | App Store | ⬜ | konsol gerekli |
| I56 | Play Store | 7.5 | 2 somut eksik |
| I57 | Push & deeplink | 8.5 | cihaz matrisi eksik |
| I58 | Yasal | ⬜ | canlı URL/metin gerekli |
| I59 | Genel olgunluk | 9.5 | TODO/FIXME/"yakında" sayısı **0** |
| I60 | Due diligence | 9.0 | ekip bilgisi eksik |

Kanıtlanan güçlü yanlar: `secureKeyValueStore.ts` sırrı **yalnız** Keychain/
Keystore'a yazıyor, güvensiz fallback sadece `removeItem` yolunda geçiyor ve
SecureStore patlarsa fail-closed davranıyor. 72.762 satırda tek bir
`console.*` var, token/secret içeren sıfır log. `navigationStateValidation.ts`
kök rotaları `isAuthenticated`'a göre ayırdığı için deeplink ile oturumsuz
korumalı ekrana girilemiyor. Hiç sosyal giriş sağlayıcısı olmadığı için
**"Apple ile Giriş" zorunluluğu uygulanmıyor**; hesap silme ve veri dışa
aktarma uygulama içinde mevcut.

Açık bulgular: `I56-01` monochrome (temalı) ikon yok — görsel varlık gerekiyor;
`I56-02` predictive back opt-in yok — geri davranışını etkilediği için cihazda
doğrulama şart; `G43-01` IDOR testi iki test hesabı bekliyor.

### 🔶 Faz 2 — PASS 2 · Grup A + B · **16 kategori** — DEVAM EDİYOR

Kapatılanlar:

- **B9/E28** — Keşfet karoları sistemin token'larını yeniden icat etmiş:
  `compactCardTitleText` ≡ `labelText` (13/18/700) ve
  `compactCardMetaText` ≡ `metadataText` (12/16/600), birebir aynı. Tek
  dosyada 17 referans orijinallere bağlandı, iki token silindi, sıfır görsel
  değişim. `spacing.none` de kaldırıldı: tanımlı, sıfır okuyucu.
- **Guard** — `check-ui-tokens` artık kullanılmayan spacing/radius token'ında
  ve iki isim bir tipografi değeri taşıdığında kırılıyor. Her iki kontrol
  kusur geri konarak doğrulandı.
- **A1 (tasarım denetimi)** — 21 ham `padding: 10`, kapsayan stil adına göre
  ölçülerek ayrıldı: 13 kart → `spacing.card`, 8 kart değil → `spacing.md`.
  `spacing.card` 3→16 okuyucu, ham `padding: 10` sıfır. Cihazda **piksel
  piksel aynı** doğrulandı.
- **A6** — üç son-çare hata mesajına kurtarma yönlendirmesi eklendi; ne
  olduğunu söylüyorlardı ama ne yapılacağını söylemiyorlardı ve toast olarak
  çıktıkları için tekrar deneme yolu yoktu.

Ölçülüp **bilerek yapılmayan** (riskli):

- **B10 tip ölçeği 9 kademe** (12,13,14,15,16,17,18,20,24 + 26) — rubrik 6-8
  istiyor ve 13/15/17'yi adıyla anti-desen sayıyor. Kademe silmek, 80+ çağrı
  yerinde görünür punto kayması demek. Ayrı pas hak ediyor.
- **Ham boşluk literalleri: 540** (`10px`:195, `4px`:143, `6px`:108,
  `12px`:67, `18px`:14, `16px`:8, `24px`:5). Guard'a "token değerine eşit ham
  literal" kuralı eklenmesi build'i anında kırar ve 540 noktalık codemod ister.

- **A4 / H48 kısmi hata toleransı** — tek error boundary vardı ve o da
  uygulamanın kökündeydi: tek bir akış kartının patlaması **tüm uygulamayı**
  hata ekranına götürüyordu. Sunucudan gelen serbest içeriği render eden bir
  kart için bu, alan değişiminin uygulamayı düşürmesi demek.
  `ContentErrorBoundary` eklendi ve akış kartına uygulandı: hata kart boyutunda
  kalıyor, yüzey adıyla Sentry'ye ve log'a raporlanıyor, yeniden deneme alt
  ağacı remount ediyor. 5 test, biri doğrudan "köke sızmıyor" iddiasını
  kanıtlıyor.

Ölçülüp **kusur çıkmayan** (kanıtla):

| Kategori | Neden temiz |
|---|---|
| A2 | `freezeOnBlur: true` + `lazy: true` sekme durumunu koruyor; `refetchOnMount: false` sekme değişiminde yeniden yükleme yapmıyor; iki `<Modal>` **kardeş, iç içe değil** — kapatma cehennemi yok; kök rotalar `{user ? …}` ile yetki kapılı |
| A3 | `useAndroidBackHandler` yalnız react-navigation'ın bilemeyeceği iç görünüm durumlarında (AuthScreen, SettingsScreen) — doğru kullanım; `exitPrompt` ile çift-basınca-çık mevcut |
| A4 | Offline merkezi `OfflineIndicator` + `feedbackPriority` + `OutboxSyncController` ile çözülmüş — ekran başına daldan daha iyi mimari |
| A5 | `autoComplete="email"`, `textContentType="username"`/`"password"`, `keyboardType="email-address"` — şifre yöneticisi autofill'i doğru kurulu |
| A6 | Kullanıcıya görünen metinde `null`/`undefined`/`Exception`/HTTP kodu sızıntısı **yok**; yıkıcı işlemler açık onay diyaloglu ("Bu işlem geri alınamaz…") |
| A7 | `canAskAgain` + `openSettings` üç izin yüzeyinin hepsinde (push, konum, medya) ele alınmış |
| A8 | `purgeAuthenticatedUserState` kullanıcı başına tek-uçuş dedup ile çıkışta yerel durumu temizliyor, imzalı medya URL durumu dahil |
| B11 | `tokens.test.ts` her okunabilir rol × her opak yüzey için **gerçek WCAG oranı** hesaplıyor; `disabled` muafiyeti WCAG 1.4.3 gerekçeli |
| B13 | İkon seti **tekil**: 81 import, hepsi `lucide-react-native` |
| B14 | Süre sistemi token'lı (fast 120 / standard 180 / slow 260) |
| B15 | Haptik `InstantPressable` üzerinden merkezi, 11 dosya |
| B16 | Taranan 14 maddenin 12'si mevcut; **undo toast N/A** — swipe-ile-silme yok (swipe yalnız sekme geçişi), yıkıcı işlemler onay diyaloguyla korunuyor |

**B13 açık bulgu:** ikon boyutları token'lı değil. `iconSize` (sm 14 / md 18 /
lg 20) yalnız **5 yerde** okunuyor, karşısında **12 farklı ham boyut** var
(9, 10, 12, 13, 14, 16, 18, 20, 24, 28, 30, 36). Rubrik standart ölçek
(16/20/24/32) istiyor. ~270 çağrı yerini değiştirmek görünür ikon boyutu
kayması demek; B10 ve boşluk ölçeğiyle aynı pasta ele alınmalı.

**B16 açık bulgu (P3):** sayaç değişimleri animasyonlu değil. Saf cila, her
sayaca animasyon eklemek jank riski taşıyor.

### ⬜ Faz 1 eski planı (referans)
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

## AAA premium UI/UX kapsamı — kalan fazlara eklenen

2026-09-22'de ayrı bir 10-PASS "AAA premium UI/UX + KISS + component
architecture" planı istendi. Ayrı süreç olarak **çalıştırılmadı**: maddelerinin
çoğu bu denetimin halihazırda tamamladığı kategorilerle birebir örtüşüyor
(design system → B9, ekran incelemesi → Grup A+B, responsive/a11y → C17–C20,
motion → B14/B16, regression → her fazın kapıları). Paralel süreç aynı işi
ikinci kez yapar ve kanıt izini böler.

Örtüşmeyen ve SoRita'ya özgü olan maddeleri **kalan fazlara dağıttım**:

| Madde | Hangi faza |
|---|---|
| Component duplicate analizi ve birleştirme | Faz 4 (E28) |
| Gereksiz abstraction / context / wrapper temizliği | Faz 4 (E29, E32) |
| God component ayrıştırma | Faz 4 (E27) |
| PlaceCard varyant sistemi (`PlaceCard` / `Compact` / `Horizontal`) | Faz 4 |
| Component envanteri: hangi primitive var, hangisi eksik, hangisi fazla | Faz 4 |
| Map UI tek görsel sistem (kontroller, preview, sheet, durumlar) | Faz 4 |
| Form UX standardizasyonu (label/helper/error/focus/disabled/loading) | Faz 5 (F35 ile) |
| Render/re-render, unstable key, inline nesne patlaması | Faz 5 (F35, D22 devamı) |

**Uygulanan kural:** "Tek kullanım + değişmeyecek davranış = component oluşturma."
Ölçülen 49 birebir tekrar eden stil gövdesinin çoğu birleştirilmedi; çünkü
`{alignItems:'center', flexDirection:'row', gap:6}` gibi gövdeler bir tasarım
kararı değil, tesadüfi düzen ilkelidir ve token'a çevirmek dolaylılık ekler,
sadeleştirmez. Birleştirme yalnız tekrar eden **kararlar** için yapıldı.

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
