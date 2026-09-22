# 60 kategorilik denetim — faz planı

Hedef: **MOBİL UYGULAMA DENETİM MASTER PROMPTU v3.0** çalıştırıldığında her
kategori ≥9.8 alsın.

Çalışma şekli: oturum başına bir faz. Her fazın sonunda durum özeti, o fazda
9.8'e çıkan kategoriler, ve **Cayan'ın yapması gerekenler**. Onay gelmeden
sonraki faza geçilmez.

Son güncelleme: 2026-09-23.

**Geçerli olan:** aşağıdaki [Faz haritası v2](#faz-haritası-v2). Onun
altındaki v1 bölümleri geçmiş kayıt; bulguların ve kanıtların kaynağı olarak
duruyor.

---

## Faz haritası v2

2026-09-23'te iki şey değişti. (1) 60 kategorilik denetime **AAA premium
UI/UX + KISS + component architecture** promptunun 10 PASS'ı eklendi.
(2) "Riskli ya da ön koşulu eksik adımı atla" kuralı: bir faz senin
erişimini bekliyorsa beklemiyoruz, ön koşulu olmayan sonraki faza geçiyoruz.

UI/UX promptu ayrı bir süreç olarak koşmuyor, maddeleri aynı kategorilere
düşüyor ve kanıt izi tek kalıyor. Sıra değişikliğinin gerekçesi: işlem
matrisi test hesabı bekliyor; UI/UX işi hiçbir şey beklemiyor. Üstelik cihaz
akışları (Maestro) UI oturduktan **sonra** yazılırsa bir kez yazılır.

| Faz | Kapsam | Kategoriler | UI/UX prompt | Ön koşul | Durum |
|---|---|---|---|---|---|
| 0 | OTA zemini, PASS 0 envanter | — | — | — | ✅ |
| 1 | iOS OTA açılışı (runtime 1.0.108) | H52, I57, I55 | — | Apple / TestFlight | 🔶 build ✅, TestFlight'ta |
| 2 | Design system envanteri, ekran ekran inceleme, duplicate analizi | B9, A2, A4, E28 | PASS 1–3 | yok | ✅ |
| 3 | Token standardizasyonu | B9–B13, E30 | PASS 4 | görsel onay | ⬜ |
| 4 | Component sistemi: PlaceCard varyantları, form UX, harita UI, durum bileşenleri | B9, E28, A4, A5 | PASS 5, §6–§8 | yok | ⬜ |
| 5 | KISS temizliği, god component | E26–E34 | PASS 6, §10–§11 | yok | ⬜ |
| 6 | Responsive/a11y, motion, görsel tutarlılık, ekran hiyerarşisi | C17–C20, B14–B16, A1–A8 | PASS 7–9, §3, §9, §12 | iOS cihaz (C) | ⬜ |
| 7–10 | İşlem matrisi I–IV: 55 işlem × 6 kontrol | A8, G41, J, F37–F39, I57, A3 | PASS 10 | 2 test hesabı | ⬜ |
| 11 | Güvenlik ve gizlilik | G41–G46 | — | Ed25519 anahtarı, staging | ⬜ |
| 12 | Veri, durum, ağ | F35–F40 | — | yok | ⬜ |
| 13 | Altyapı ve operasyon | H47–H54 | — | pano erişimleri | ⬜ |
| 14 | Performans | D21–D25 | §13 | yok | ⬜ |
| 15 | Toplu native sürüm, yayın, yasal | I55–I60, J | — | konsollar, hukuk | ⬜ |
| 16 | Final denetim: iki prompt baştan, tek commit | 61 alanın hepsi | final rapor | — | ⬜ |

### UI/UX prompt maddelerinin yerleşimi

| UI/UX prompt maddesi | Faz |
|---|---|
| §1 repo incelemesi, UI ↔ component mimarisi kopukluğu | 2 |
| §2 SoRita kimliği (sakin, görsel ağırlıklı, kalabalık değil) | 2'de ölçüt, 3–6'da uygulanır |
| §3 ekran ekran hiyerarşi, birincil/ikincil aksiyon, yoğunluk, ritim | 2 tespit, 6 uygulama |
| §4 tek kaynak token sistemi (colors…zIndex) | 3 |
| §5 component sistemi, "tek kullanım = component yok" | 4 |
| §6 PlaceCard tek görsel dil ve gerçek varyantlar | 4 |
| §7 harita UI tek sistem | 4 |
| §8 form UX standardı | 4 |
| §9 AAA cila: pressed/focus/disabled/loading, skeleton, layout stabilitesi | 6 |
| §10 KISS temizliği: duplicate, ölü kod, gereksiz wrapper/context/state | 5 |
| §11 god component | 5 |
| §12 responsive/a11y, 1.5× tipografi sorunlarının benzerleri | 6 |
| §13 render performansı, her `useMemo`/`useCallback`'in sorgulanması | 14 |
| §14 PASS 10 regresyon | her fazın kapıları + 16 |
| §16 final UI/UX raporu | 16 |

Yeni özellik yok: promptun PlaceCard maddesindeki "rating" ve "distance"
SoRita'da yoksa **eklenmez**, mevcut meta alanlarıyla aynı ızgara kurulur.

### Faz sonu kuralı

Her faz: denetle → düzelt → cihazda kanıtla → `typecheck`, `security:verify`,
`check:release` yeşil → tik yalnız kanıtla → özet, Cayan'ın manuel adımları,
devam onayı.

---

## Faz 1 kaydı — iOS OTA (2026-09-23)

- HEAD, Android'in 1.0.108 binary'sine (`53d8d90`) göre `OTA_SAFE`; iOS aynı
  runtime'a katılabilir.
- İlk iOS build (`b8f54bb5`) `pod install`'da düştü: react-native-firebase
  26.4, Firebase'i SPM ile çözüyor ve bu projenin static frameworks'ü altında
  SPM'i reddediyor. 1.0.102 build'i 25.1 ile CocoaPods yolundan geçmişti.
- Düzeltme: plugin'in kendi `ios.disableSPM` seçeneği (`6aa074b`, dal
  `ios-firebase-cocoapods`). Linkage ve runtime değişmedi.
- İkinci build (`25c05493`, 1.0.109 / 94, runtime 1.0.108) **başarılı**;
  TestFlight'a gönderildi.
- **Açık karar:** düzeltme `app.config.ts`'e dokunduğu için sınıflandırıcı onu
  Android için de native sayıyor. Dal main'e alındığı an Android OTA,
  yeni Android binary'si mağazada kaydedilene kadar kilitlenir. Bu yüzden dal
  şimdilik ayrı. Main'e alınması ve iOS kaydı (`ota:record-binary`, binary
  commit'i HEAD'in atası olmalı) Cayan yeni Android paketini Play'e
  yüklediği gün birlikte yapılır; Faz 15'i beklemek zorunda değil. O güne
  kadar Android OTA açık kalır, iOS TestFlight gömülü JavaScript'le çalışır.

## Faz 2 raporu — UI/UX PASS 1–3 (2026-09-23)

Cihaz: Redmi Note 9 Pro, Android 10, 1080×2400, yoğunluk 440 (2.75×), yazı
ölçeği 1.0. Ekranlar yalnız okuma amaçlı gezildi; hiçbir veri yazan butona
basılmadı.

### PASS 1 — Design system envanteri

| Grup | Durum | Bulgu |
|---|---|---|
| Tipografi | ✅ | 16 stil, 10 boyut; kodda ham `fontSize`/`lineHeight` **0** |
| Renk | ⚠ | 60 token, semantik katman var; 5 hex birden çok isim taşıyor (`#b45309` ×3, `#047857` ×3, `#2563eb` ×3, `#6d28d9` ×2, `#475569` ×2); nötrlerde slate ile bir Tailwind gray (`#e5e7eb`) karışık |
| Boşluk | ⚠ | 9 token; 6/10/18 4pt ızgarası dışında; kodda **807 ham değer, 33 farklı** |
| Köşe | ⚠ | 8/11/15/20 — 11 ve 15 ızgara dışı; kodda 51 ham, 16 farklı |
| İkon boyutu | 🔴 | 3 token (14/18/20), 5 okuyucu; kodda **280 ham, 17 farklı** |
| Gölge | ⚠ | 3 seviye; `shadowColor` zaten %12 alfa taşıyor, `shadowOpacity` ikinci kez çarpıyor → iOS'ta etkin gölge %1.4–2.4, görünmez |
| zIndex / opacity | 🔴 | token yok; 15 ham zIndex (5 farklı, `1000` dahil), 14 ham opacity (10 farklı) |
| Motion | ✅ | 3 süre token'ı; kodda 4 ham süre |

### PASS 2 — Ekran ekran inceleme

| Ekran | Bulgu | Sınıf | Nerede |
|---|---|---|---|
| Liste detayı, konum kartları | Fotoğraf sağda 12dp kısa: `aspectRatio` + `marginHorizontal` aynı view'da, Yoga margini iki kez düşüyor | DÜZELTME | ✅ bu faz |
| Liste detayı, bildirimler, ayarlar, auth | Tab dışı her ekranda alt güvenli alan iki kez: bu telefonda 57dp ölü şerit, bildirimde son satır kesik | DÜZELTME | ✅ bu faz |
| Profil, kullanıcı profili | Sekme sayaçları yüklenen sayfanın uzunluğu: açılmamış sekme "0", 24+ içerikte "24" | DÜZELTME | ✅ bu faz |
| Liste detayı | Mekân kartları ekran kenarına dayanıyor, köşeleri kesiliyor; başlık kartı 12dp içeride | DÜZELTME | ✅ bu faz |
| Mekân kartı | "Diğer özellikler +13" 48dp boyalı, yanındaki chip'ler 24dp | CİLA | ✅ bu faz |
| Mekân kartı, liste detayı | Menü butonu ekran okuyucuya "Profil işlemleri" diyor | DÜZELTME | ✅ bu faz |
| Ana akış kartı | Mekân adı 5. sırada (yazar → liste → adres → harita → **ad**); 4 iç içe kutu (kart > liste kutusu > adres hapı > harita çerçevesi) | CİLA | Faz 6 |
| Ana akış kartı | Beğeni sayısı kalpten ayrı 48dp hücrede, kopuk duruyor | CİLA | Faz 4 |
| Statik harita | Rakip işletme POI'leri (ör. başka tatlıcılar) kartın haritasında | CİLA | Faz 4 |
| Harita | İstanbul'da 3 pin üst üste, küme sayısı yok; lejantta "Sadece ikisi" belirsiz; ilk açılış ipucu Google logosunu örtüyor | DÜZELTME/CİLA | Faz 4 |
| Keşfet, kullanıcı profili | Kapaksız liste karosu: 110dp boş mavi alan + 16dp emoji | CİLA | Faz 4 |
| Keşfet | Karo başlığında 16dp avatar, 2 satırlık isim bloğunun yanında küçük; baş harfler okunmuyor | CİLA | Faz 3 |
| Profil | İstatistik satırı ile sekmeler arasında büyük boşluk | CİLA | Faz 3 |
| Bildirimler | Türkçe karakter eksik ("begendi"), beğen-geri al-beğen aynı bildirimi iki kez üretiyor — ikisi de repoda olmayan bir DB trigger'ından | DÜZELTME | Faz 7–10 (migration onayı) |
| Bildirimler | Stack ekranı başlığında marka logosu tekrar; tarih mutlak | CİLA | Faz 6 |
| Ayarlar | Temiz. Aynı kalkan ikonu iki farklı renkte (Gizlilik yeşil, Kişisel veriler mavi) | CİLA | Faz 3 |
| Yorumlar sheet'i | Temiz, boş durum yönlendirici | — | — |

### PASS 3 — Duplicate analizi (ölçüm)

| Kalıp | Ölçüm | Hedef | Faz |
|---|---|---|---|
| Chip / pill / badge | 19 dosyada **72** ayrı stil tanımı, ortak primitive yok | `Chip` (seçilebilir) + `Badge` (statik) | 4 |
| Modal katmanı | `ModalScaffold` 5 kullanıcı; **8** dosya kendi `<Modal>`'ını yazıyor | Tek `Sheet`/`ModalScaffold` | 4 |
| Lightbox | `ImageLightbox` (329 satır) + `MediaLightbox` (552 satır) | Tek lightbox | 5 |
| Basma primitive'i | 35 dosya `InstantPressable` (haptik + basılı durum), **34** dosya ham `Pressable` | Tek yol | 4 |
| Profil sekme dizisi | İki ekranda birebir 30 satır | ✅ `buildProfileTabOptions` ile tekilleşti | bu faz |
| Başlık | `StackScreenHeader`, bildirimlerin kendi başlığı, profil hero geri butonu | Tek başlık | 4 |

### Bu fazda teslim edilen

| # | Değişiklik | Test |
|---|---|---|
| F1 | Mekân fotoğrafı: inset sarmalayıcıya, `aspectRatio` iç çerçevede; sayfa genişliği pager'dan | yeni test, eski kodda kırılıyor |
| F2 | `Screen`: alt inset tek sahipli (içerik padding'i) | yeni test, eski kodda 104 ≠ 57 |
| F3 | Profil sayaçları: tüm sayfalar gelince yüklenen uzunluk, öncesinde sunucu toplamı, yoksa sayı yok | 4 yeni test |
| F4 | İçerik menüsü etiketi "İçerik işlemleri"; kullanılmayan `overflowActionLabel` prop'u silindi | mevcut test güncellendi |
| F5 | Özellik açma chip'i 24dp boyalı + `hitSlopFor(24)` → 48dp etkin | touch-target guard |
| F6 | Liste detayı kartlarına başlıkla aynı 12dp inset | cihazda |

### Cihaz kanıtı

`check:release` yeşil (1271 test, satır kapsamı %94.7), OTA grubu
`c6aae767` production runtime 1.0.108'e yayınlandı. Telefon ilk soğuk
başlatmada `Update available` → `DownloadComplete` (update `01a0cb41`)
logladı, ikincisinde onu çalıştırdı. Ölçümler `uiautomator` sınırlarından,
fiziksel piksel:

| # | Önce | Sonra |
|---|---|---|
| F1 | fotoğraf 39→1013, harita 39→1042 (sağda 29px kısa) | fotoğraf 72→1009, harita 72→1009; 2. sayfa tam 1010'da başlıyor |
| F2 | liste 2113'te bitiyor, gezinme çubuğu 2270 | içerik gezinme çubuğunun hemen üstüne iniyor |
| F3 | Mekânlar 0 → açınca 24, Galeri 0 | açmadan Mekânlar **34**, Galeri sayısız |
| F4 | "Profil işlemleri" | "İçerik işlemleri" (başlık ve kart menüsü) |
| F5 | chip 132px (48dp) | 66px (24dp), yanındaki chip'lerle aynı |
| F6 | kart 0→1080 | kart içeriği 69→1011, iki yanda eşit |

### Doğrulama sırasında çıkan yeni bulgu

Liste detayındaki "Mekân konumları" haritası sayfanın ortasında ve tek
parmak dikey kaydırmayı yakalıyor: sayfayı kaydırmak isteyen kullanıcı
haritayı okyanusa sürüklüyor. Kart haritaları dokunarak etkinleştiriliyor
(`useMiniMapInteraction`), bu harita etkinleştirmeden etkileşimli.
**Faz 4**, harita UI sistemi.

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

## Faz haritası v1 (geçmiş kayıt)

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

### 🔶 Faz 4 — PASS 4 · Grup E — DEVAM EDİYOR

Ekran ekran cihaz taraması bu fazda üç gerçek kusur buldu; ikisi kapatıldı.

**Kapatılan — modal odak kaybı (C19).** `ModalScaffold` modal açılınca ekran
okuyucu odağını içeri taşıyor ve duyuruyor. Üç sheet onu kullanmıyordu ve kendi
overlay'ini elle yazmıştı: yorum işlem sheet'i ve iki medya host'u.
`accessibilityViewIsModal` veriyorlardı ama imleci kimse taşımıyordu, yani
TalkBack açıkken sessizce açılıyorlardı. Davranış `useModalAccessibilityFocus`
oldu; `ModalScaffold` 34 satır küçüldü, üç sheet üçer satır kazandı, yerleşim
değişmedi. 5 test.

**Kapatılan — tam ekran medyada sistem çubukları (B16).** Lightbox açıkken saat
ve pil ikonları koyu zeminde koyu çiziliyordu. `AppSystemBars` içinde tam bunun
için yazılmış `'media'` modu ve `useSystemBarMode` varmış, **hiç çağrılmamış**;
push/pop yığını her ekranda varsayılana çözülüyormuş. Silmek yerine bağlandı:
kullanılmayan soyutlama değil, son kablosu takılmamış makine. Öncesi/sonrası
cihaz görüntüsüyle doğrulandı. Test mock'u `StatusBar`'ı yalnız imperatif
namespace olarak veriyordu, artık hem bileşen hem namespace.

**Sağlamlaştırma — koordinat doğrulaması.** `getMapMarkers` koordinatları hiç
doğrulamadan Static Maps URL'ine geçiriyordu; `lat: 0, lng: 0` olan bir satır
Gine Körfezi'nde açık deniz ister. Sonlu, aralıkta ve 0,0 olmayan çiftler artık
süzülüyor. Dosyanın hiç testi yoktu, 11 test eklendi.

⚠️ **Bu, Keşfet'te görülen boş haritaları çözmedi.** Yayınlanıp cihazda
doğrulandı: kartlar hâlâ düz mavi zemin + tek pin gösteriyor. Teşhis yanlıştı,
düzeltme yine de doğru bir sağlamlaştırma ama semptomu açıklamıyordu.

**Açık — Keşfet kartlarında harita döşemeleri yüklenmiyor (P2).** Gördüğüm şey
`MiniMapFallback` değil: o pin + başlık + "önizleme yok" metni çizer, ekranda
hiç metin yok. Kalan açıklama, döşemeleri gelmemiş **native Google harita
görünümü**. Dikkat çeken ayrım: ana akış kartı **statik** harita kullanıyor ve
sorunsuz render ediyor (logcat'te `staticmap?size=335x148` başarıyla yükleniyor),
Keşfet karoları ise **native** harita kullanıyor. Uygulama iki ayrı anahtar
taşıyor — statik ve native Maps SDK — ve statik olanın çalıştığı kanıtlı.
Native anahtarın kısıtlaması Google Cloud Console'dan kontrol edilmeli; bu,
PASS 0'daki erken uyarı #3 ile aynı yere çıkıyor.

**Kapatılan — tarih hiyerarşisi (A6).** `editedAt` etiketi kendi içinde `· `
taşıyordu ve çağıran zaten `' · '` ile birleştiriyordu, sonuç
"13.04.2026 · düzenlendi · 08.09.2026" — "düzenlendi" bağımsız bir metadata
öğesi gibi okunuyordu. Artık "13.04.2026 · düzenlendi 08.09.2026".

**Açık — bildirim metinleri bu repoda üretilmiyor (P2).** Bildirimler ekranı
`"Bottega" mekanini begendi` gösteriyor: Türkçe karakterler eksik ("beğendi",
"mekânını") ve ekranda 7 kez tekrarlıyor. `NotificationListItem` sunucudan gelen
hazır `notification.message` alanını doğrudan basıyor, ve **bu metin kod
tabanının hiçbir yerinde yok** — ne i18n'de, ne migration'larda, ne edge
function'larda. Yani mesajı, tracked migration'larda tanımlı olmayan bir
veritabanı trigger'ı yazıyor. Bu hem kopya kusuru hem veritabanı sapması
işareti; düzeltmesi veritabanı erişimi ister ve mevcut satırları geriye dönük
düzeltmez.

**Açık — ölçülüp bilerek dokunulmayan.** `PlaceCard.tsx` 724 satır ama state'i
`usePlaceCardState`'e çıkarılmış ve bütçeler resmi olarak sağlanıyor; çalışan
bir bileşeni yalnız satır saymak için bölmek, promptun kendi kuralının yasakladığı
şey. Beş `Deferred*` sarmalayıcı aynı 5 satırlık deseni tekrar ediyor ama
jenerik bir yardımcıya indirmek 724 satırlık dosyada ~10 satır kazandırır;
asıl sorun orası değil.

### ⬜ Faz 4 kalanı — PASS 4 · Grup E
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
