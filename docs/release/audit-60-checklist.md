# 60 kategorilik denetim: faz checklist'i (v3)

Hedef: **MOBİL UYGULAMA DENETİM MASTER PROMPTU v3.0** baştan çalıştırıldığında
61 puanlama biriminin (60 kategori + J-Sosyal modülü) **her biri ≥ 9.8** alsın.
Ayrıca uygulamadaki **84 kullanıcı işleminin her biri** 8 kontrolden tek tek
geçsin.

Oluşturulma: 2026-09-23. Bu dosya [audit-60-plan.md](./audit-60-plan.md)
içindeki v2 faz haritasının yerini alır. Oradaki Faz 1–2 raporları ve PASS 1–2
bulguları kanıt kaynağı olarak geçerliliğini korur.

35 kategorilik `release-scorecard.json` ([9.8-checklist.md](./9.8-checklist.md))
**ayrı bir iştir**, bu planın hedefi değildir.

---

## Çalışma kuralı

1. Her oturumda **bir faz** yapılır.
2. Faz akışı: denetle → düzelt → `typecheck`, `security:verify`,
   `check:release` yeşil → OTA → `ota:verify-device` ile cihaza teslimi kanıtla
   → cihazda ölç → tik at.
3. Tik yalnızca kanıtla atılır: ölçüm, dosya:satır ya da cihaz çıktısı ve aynı
   commit'te yeşil kapılar. "Kod yazıldı" tik sayılmaz, "yayınlandı" da
   sayılmaz.
4. Faz sonunda üç şey verilir: durum özeti, **Cayan'ın manuel adımları** ve
   devam onayı sorusu. Onay gelmeden sonraki faza geçilmez.
5. Yeni özellik eklenmez (K3). Store'un zorunlu tuttuğu bir eksik çıkarsa
   `[STORE ZORUNLULUĞU]` olarak karar Cayan'a sunulur.
6. Kapsam dışı (§3): dark mode, yeni dil, RTL, yeni ekran, tablet tasarımı.
   Bu maddeler N/A sayılır ve ortalamaya katılmaz.
7. Final puanı Claude vermez. Final denetim, bu planı bilmeyen temiz bir
   oturumda yapılır (Faz 28).

---

## Eklenen gereksinimler (2026-09-23, Cayan)

Cayan'ın sözü: "tüm fazları sırayla uygula". Telefon bağlı, Supabase erişimi
verildi. Fazlar sırayla yürür; ön koşulu eksik olan faz atlanır ve kaydı
düşülür. Her faz sonunda yine rapor yazılır.

| Gereksinim | Nereye düştü |
|---|---|
| UI/UX ana kalemimiz. AAA premium his, kalite çıtası Instagram, Facebook ve Reddit (kopya değil; SoRita kimliği: sakin, görsel ağırlıklı, kalabalık değil) | Faz 3, 5, 6 ve 9A/9B. Faz 9 ikiye bölündü: **9A** motion, cila ve durum matrisi; **9B** ekran ekran premium görsel tur ve tutarlılık incelemesi (UI/UX prompt PASS 8–9, §3) |
| Tüm ekranlarda gezinilecek, her şeyle etkileşime girilecek | Faz 9B keşif turu + Faz 11–19 işlem matrisi |
| Hesap silme, çıkış, şifre sıfırlama ve şifre değiştirme Cayan'ın hesabında **yapılmaz** | İ09, İ11, İ12, İ13, İ17 yalnız test hesaplarında (Faz 8) koşulur |
| Başka gerçek kullanıcıya bildirim düşüren işlemler (beğeni, takip, yorum) | Yalnız Cayan'ın kendi içeriğinde ya da test hesapları arasında denenir |
| Var olan ve olası bütün bug'lar düzeltilecek | Her fazda bulunan bug aynı fazda düzeltilir; T1–T8 matrisi |
| Yalnız dikey ekran; döndürmeden hiçbir ekran etkilenmez | Faz 3: otomatik döndürme açıkken her ekran, modal, lightbox ve tam ekran video cihazda denenir. Faz 4: manifest ve `Info.plist` kilidi |
| En küçükten en büyüğe her ekran; çentik, dar, geniş ve katlanabilir ekran | Faz 10: 320, 360, 393, 411 ve 480dp; katlanabilir iç ekran; çentik simülasyonu. Faz 26: iPhone |
| KISS, sade kod, hardcode yok; tekrar eden her şey component | Faz 3 (token), 5–6 (component), 7 (KISS), 8 (hardcode) |
| "Işık hızında" hissi | Faz 9A (anında basılı durum, optimistik güncelleme, skeleton) + Faz 22 (ölçüm) |
| AAA premium UI/UX + KISS + component architecture promptu | PASS 1–3 → Faz 2 ✅ · PASS 4 → Faz 3 · PASS 5 → Faz 5–6 · PASS 6 → Faz 7 · PASS 7 → Faz 10 · PASS 8 → Faz 9A · PASS 9 → Faz 9B · PASS 10 → her fazın kapıları. Her PASS sonunda §16 rapor başlıkları kullanılır |

---

## Nerede kaldık

| Faz | Durum | Not |
|---|---|---|
| 0: OTA zemini, PASS 0 envanter | ✅ | |
| 1: iOS OTA | 🔶 | Build `25c05493` TestFlight'ta. Dal main'e alınmadı ve iOS binary'si kaydedilmedi; bu iş Faz 4'te kapanır |
| 2: Design system envanteri, ekran incelemesi, duplicate analizi | ✅ | Cihaz kanıtı `audit-60-plan.md` içinde |
| 3: Token sistemi + bekleyen teslimat | ✅ | OTA `f81614b1` cihazda çalışıyor. Bildirim migration'ı (`20260923010000`) sonradan production'a uygulandı |
| 4: Native paket #1 | 🔶 | Dal `native/faz-4`: tek splash, dikey kilit, tema ikonu, 1.0.110 (116). Cihazda doğrulandı (aşağıda). Kalan: Play yüklemesi ve iOS TestFlight (Cayan), yüklenince main'e alma ve `ota:record-binary` |
| 5: Component sistemi I | 🔶 | 1. tur: basma primitive'i, Chip, Badge, SheetHeader, sheet'ler, tek seviyeli menü; P0 production'da kapandı. 2. tur: profil ve Keşfet kaydırma, yorumlar, bildirimler, paylaşım bağlantısı (aşağıda). Kalan: form standardı, durum bileşenleri, kendi `<Modal>`'ını yazan 4 sheet. 3. tur (Faz 5–9 birleşik, E1–E20): ızgara, akış, push bandı, düzenleyici; 8 OTA grubu cihazda |
| 6: Component sistemi II | 🔶 | Harita logosu ve ipucu, liste haritası, keşif karoları tamam. Harita durumları: hata, izin ve arama zaten vardı; filtre bütün pinleri gizleyince uyarı ve "Tümünü göster" eklendi (OTA 39). Kart ailesi tek dil (Full kart + mozaik karo). Kalan: filtre uyarısının cihaz kontrolü, Maps anahtar kısıtı ekran görüntüsü (Cayan) |
| 7: KISS ve mimari | ✅ | E26, E27, E28, E29, E32 kanıtlı (aşağıda Faz 7 kaydı). OTA 29–32 cihazda |
| 8: Kod kalitesi II | 🔶 | E31 karmaşıklık sınırı 35 → 30, E34 akış kartı şema testi. E34 sözleşme belgesi `docs/api-contracts.md`. Kalan: E30 sınıflandırma, E33 saat enjeksiyonu, Maestro (test hesapları, Cayan) |
| 10: Android uyumu, erişilebilirlik | 🔶 | A3: geri tuşu açık menüyü kapatıyor (harita, profil), editör değişiklik soruyor. Kalan: ekran/sheet matrisi; ekran boyutu, yazı ölçeği ve TalkBack sistem ayarı gerektiriyor (Cayan onayı) |
| 20: Güvenlik | 🔶 | G42: Sentry olayları ve breadcrumb'lar redakte ediliyor, Android yedekleme kapalı. G44: release R8 açık, pano yalnız yazılıyor. Kalan: G41/G43/G46 test hesaplarıyla |
| 21: Veri, durum, ağ | 🔶 | Kodda doğrulandı: arama yarışları (F35), durum koduna göre yeniden deneme (F36), zaman gösterimi (F40). Kalan: uçak modu tablosu (sistem ayarı, Cayan onayı), outbox ve optimistik geri alma testleri (test hesapları) |
| 22: Performans | 🔶 | Android: soğuk açılış medyan 792 ms / p90 844 ms (bütçe 2500), arka planda konum/alarm/wakelock yok, harita ziyaretlerinde bellek çöp toplamadan sonra düz (20 ziyaret, 273 → 278 MB). Kaydırma: profil %3,7 (bütçe %5); ana sayfa ölçümden ölçüme %6–11, kaynağı kart kurulumu. 2. tur düzeltmesi OTA 38'de (aşağıda), cihaz ölçümü bekliyor. iOS ölçümü (Cayan) |
| 24: CI/CD, sürüm, belgeleme | 🔶 | Quality iş akışı yeniden yeşil (Gitleaks). CI'daki kırmızı yalnız kapalı EAS build değişkenlerinden. Geri alma gerçek olayla prova edildi (OTA 33 → 32). `npm audit` üretim bulgusu azaltıldı (OTA 40). CHANGELOG ve API sözleşmesi güncel. Kalan: branch koruması, zorunlu güncelleme kararı, uptime URL'si (Cayan), temiz klon provası |
| 25: Native paket #2, store, yasal | 🔶 | Ayarlar'da "Yasal" grubu (OTA 36) ve "Hesap gizliliği" adı (OTA 37) cihazda. Bildirim ikonu `native/faz-4` dalında. Kalan: store formları, hukuk onayı, build yüklemeleri (Cayan), iOS gizlilik manifesti ve Data Safety karşılaştırması |

---

## Faz listesi

Sütunlar: **Kapanır**, o fazın sonunda 9.8'e çıkıp tiklenecek kategorileri
gösterir. **Cayan**, senin yapman gerekeni ve tahmini süreyi gösterir.

| ✓ | Faz | Kapsam | Kapanır | Cayan |
|---|---|---|---|---|
| ✅ | 0 | OTA zemini, envanter | — | — |
| 🔶 | 1 | iOS OTA (build TestFlight'ta) | Faz 4'te kapanır | — |
| ✅ | 2 | Envanter, ekran incelemesi, duplicate | — | — |
| ✅ | 3 | Token sistemi kalanı + bekleyen teslimat | B10 (cihaz ölçümü bir sonraki OTA'da) | Migration'ı uygulamak (1 dk) |
| ⏸ | 4 | Native paket #1 + iOS OTA açılışı | B13, Faz 1 | İkon onayı, AAB → Play, TestFlight kurulumu (~30 dk); native dosyalara izin |
| 🔶 | 5 | Component sistemi I: primitive'ler, durum bileşenleri, form standardı | — | Supabase `db push` (P0) |
| 🔶 | 6 | Component sistemi II: PlaceCard varyantları, harita UI | B9 | Maps anahtar kısıtı ekran görüntüsü (5 dk) |
| ✅ | 7 | KISS ve mimari | E26, E27, E28, E29, E32 | — |
| 🔶 | 8 | Kod kalitesi II + E2E altyapısı | E30, E31, E34 | 3 test hesabı + ortam değişkeni (15 dk) |
| ⬜ | 9A | Durum matrisi, motion, cila, "ışık hızı" hissi | A4, B14, B15, B16 | — |
| ⬜ | 9B | Ekran ekran premium görsel tur, keşif amaçlı etkileşim turu, tutarlılık | B11, B12 | Görsel onay (10 dk) |
| 🔶 | 10 | Android cihaz uyumu ve erişilebilirlik | Android satırları | — |
| ⬜ | 11 | İşlem matrisi I: hesap yaşam döngüsü (İ01–İ13) | A1, A8 | Doğrulama e-postasındaki linke dokunmak (10 dk) |
| ⬜ | 12 | İşlem matrisi II: profil ve ayarlar (İ14–İ23) | — | — |
| ⬜ | 13 | İşlem matrisi III: sosyal graf (İ24–İ31) | — | B hesabı ikinci cihazda açık |
| ⬜ | 14 | İşlem matrisi IV: listeler (İ32–İ39) | — | — |
| ⬜ | 15 | İşlem matrisi V: mekân kartları (İ40–İ50) | — | — |
| ⬜ | 16 | İşlem matrisi VI: medya (İ51–İ57) | F39 | — |
| ⬜ | 17 | İşlem matrisi VII: yorum ve beğeni (İ58–İ65) | A5 | — |
| ⬜ | 18 | İşlem matrisi VIII: akış, keşfet, harita, navigasyon, kesinti (İ66–İ75) | A2 | — |
| ⬜ | 19 | İşlem matrisi IX: bildirim, push, deep link (İ76–İ84) | A6 | App link dosyalarının yayında olduğunu teyit (5 dk) |
| 🔶 | 20 | Güvenlik ve kötüye kullanım | G41, G42, G43, G44, G46 | SSL pinning kararı, moderasyon sorumlusu (5 dk) |
| 🔶 | 21 | Veri, durum, ağ | F35, F36, F37, F38, F40 | — |
| 🔶 | 22 | Performans | D21, D22, D23, D24, D25 | iPhone'da 10 soğuk açılış (5 dk) |
| ⬜ | 23 | Backend ve gözlemlenebilirlik | H47, H48, H49, H50 | Sentry / Supabase / PostHog erişimi (15 dk) |
| 🔶 | 24 | CI/CD, sürüm, bağımlılık, belgeleme | E33, H51, H52, H53, H54 | Branch koruması, zorunlu güncelleme kararı (10 dk) |
| 🔶 | 25 | Native paket #2 + store + yasal | G45, I55, I56, I58 | Konsol formları, hukuk onayı, build yüklemeleri (1–2 sa) |
| ⬜ | 26 | iOS cihaz turu | A3, A7, C17, C18, C19, C20, I57 | iPhone'da senaryo + ekran kaydı (2–3 sa, 2 oturum) |
| ⬜ | 27 | Olgunluk, due diligence, J-Sosyal | I59, I60, J-Sosyal | 3 soru: ekip, yol haritası, bütçe (10 dk) |
| ⬜ | 28 | Final denetim (temiz oturum, tek commit) | puanlanır | Promptu yeni oturuma yapıştırmak (2 dk) |
| ⬜ | 29 | Düzeltme döngüsü (9.8 altı kalırsa, tekrarlanır) | kalanlar | duruma göre |

Kalan: **27 faz** (3–29). Tahmin: 27 oturum. Faz 29 gerekirse tekrarlanır.

---

## Faz detayları

### ✅ Faz 3: Token sistemi kalanı + bekleyen teslimat

Claude:
1. Faz 2 sonrası 7 commit'i cihaza teslim et: `check:release` → `ota:publish`
   → `ota:verify-device` → 12 production ekranında önce/sonra ölçümü
   (`uiautomator` sınırları).
2. Renk: aynı hex'i taşıyan 5 isim çiftini tek semantik isme indir; nötrlerdeki
   slate ile Tailwind gray karışımını tek skalaya çek.
3. Gölge: iOS'ta alfanın iki kez çarpılması (`shadowColor` %12 ×
   `shadowOpacity`) yüzünden gölgeler görünmüyor, düzelt. Elevation tek sistem.
4. `zIndex` ve `opacity` token'ları (Faz 2 ölçümü: 15 ham zIndex, 14 ham
   opacity). Token guard'ı ham değer görünce build'i kırsın.
5. Faz 2'den kalan CİLA işleri: Keşfet karo avatarı 16dp, profilde istatistik
   ile sekmeler arası boşluk, Ayarlar'da iki farklı renkteki kalkan ikonu.
6. Bildirim migration'ı (`b22ebfc`): Cayan onay verince `supabase db push`,
   ardından `ops:rpc:verify`. Cihazda "beğendi" metni ve beğen/geri al/beğen
   sonrası tek bildirim kontrol edilir.

Kapanır: **B10, B11**. B9 ve B12'ye katkı sağlar.
Cayan: migration'a "uygula" onayı. Telefon USB ile bağlı ve kilidi açık olmalı.

### Faz 3 kaydı (2026-09-23)

**Teslim:** OTA grubu `f81614b1` (Android, runtime 1.0.108, update
`01a0ce5c`). `ota:verify-device`: kurulu binary 1.0.108 gömüyor. İlk soğuk
başlatma `DownloadComplete`, ikincisi `CheckCompleteUnavailable`; ana akış
kartı yeni okuma sırasıyla ve sakin haritayla açıldı. Bu, Faz 2'den sonra
bekleyen 7 commit'in de telefona ilk kez ulaşması demek.

| # | Değişiklik | Ölçüm / kanıt |
|---|---|---|
| T1 | Ham palet katmanı: her renk bir kez; `colors` yalnız paletten okur | guard: tekrar eden hex ve `colors` içinde ham renk build'i kırar |
| T2 | 56 renk adı 42'ye indi (aynı rolü taşıyan 14 kopya birleşti), `semanticColors` katmanı kaldırıldı | 18 dosya, testler yeşil |
| T3 | Gölgeler: iOS'ta çift alfa yüzünden %2'de çizilen gölgeler düzeldi; 9 elle yazılmış gölge 4 seviyeye bağlandı | yeni test: gölge mürekkebi opak, opacity > 0.04 |
| T4 | zIndex (5 katman), opacity (disabled 6 farklı değerden 1'e), konum ofsetleri (53 ham değer) token'a | guard: her biri geri konunca build kırıldı (8/8 yakalandı) |
| T5 | Avatar ölçeği 7 boyuttan 3'e (24/32/40); baş harfler tip ölçeğinden | Keşfet'te "SD" artık okunuyor |
| T6 | Ayarlar: 5 renk → tek mürekkep; veri dışa aktarma kendi ikonuyla | cihaz ekran görüntüsü |
| T7 | Profil: takipçi satırı ile sekmeler arası görsel boşluk 54dp → 38dp; hiç görünmeyen `ProfileStatsRow` silindi | uiautomator: sekmeler y=1446 → 1402 |
| T8 | 12 dosyadaki elle türetilmiş dokunma alanı → `minTouchSize` | guard kuralı |
| T9 | 11 sayaçta eşit genişlikli rakam | commit `c186db6`, cihaz ölçümü bir sonraki OTA'da |

**Dikey kilit (cihaz):** `user_rotation=1` ile telefon yataya zorlandı. Ana
sayfa, liste detayı (stack) ve tam ekran kapak (modal) açıkken ekran
`ROTATION_0` kaldı, uygulama `SCREEN_ORIENTATION_PORTRAIT` istedi. Ayar
eski haline döndü. Native manifest ve `Info.plist` kilidi Faz 4'te.

**Kapılar:** `check:release` yeşil: 2903 test, satır kapsamı %94.71.

**Açık kalan:**
- Bildirim migration'ı (`20260923010000`). Production şeması dökülüp
  karşılaştırıldı: `create_notification` gövdesi aynı, push ayrı bir
  trigger'da; beş `notify_*` fonksiyonunun mantığı birebir aynı, yalnız
  metinler değişiyor. `db push --dry-run` yalnız bu dosyayı gösterdi. Gerçek
  `db push` izin sistemince reddedildi → Cayan'ın adımı.
- B11'in "her ekranda birincil eylem baskın mı" maddesi ekran bazlı; tik
  Faz 9B'ye taşındı.
- Faz 3'te görülüp sonraki fazlara yazılanlar: harita kontrolleri 44dp
  (Android tabanı 48) ve tutarsız gölge → Faz 6; iki karakter sayacı iki
  farklı ofset/renkte → Faz 5 form standardı; Keşfet önerilerinde 0 mekânlı
  liste → Faz 9B; akış kartında beğeni "0" gösteriliyor ama yorum sayısı
  gösterilmiyor → Faz 9B; yüklenirken boş gri statik harita → Faz 9A.

### ⬜ Faz 4: Native paket #1 + iOS OTA açılışı

Claude:
1. `ios-firebase-cocoapods` dalını main'e al.
2. Portre kilidini `AndroidManifest` (`screenOrientation`) ve `Info.plist`
   (`UISupportedInterfaceOrientations`) içine yaz. Şu an yalnız JS tarafında.
3. Mevcut logodan Android monokrom (temalı) ikon katmanı üret, önizlemesini
   Cayan'a göster.
4. Native yüzey değiştiği için `nativeRuntimeVersion` yükselt.
5. Android AAB ve iOS build'ini EAS ile al.
6. Tek splash: Android 12+ sistem splash'i yuvarlak maskeli logoyu
   gösteriyor, ardından JS splash'i (logo ve telif yazısı) geliyor.
   `android/app/src/main/res/values/styles.xml` içinde
   `windowSplashScreenAnimatedIcon` değerini `@android:color/transparent`
   yap; arka plan `#f8fafc` kalsın. iOS'ta açılış ekranı zaten telif yazılı
   görsel, değişiklik gerekmez. Bu dosya bu oturumun sandbox'ında yazmaya
   kapalı; native build'e girer.
7. Binary'ler yüklenince iki platformu `ota:record-binary` ile kaydet. İlk iOS
   OTA'yı yayınla. Mac olmadığı için iOS teslimatını Sentry olaylarındaki
   update id etiketinden kanıtla.

Kapanır: **B13**, **Faz 1 ✅**. H52'ye katkı sağlar.
Cayan: monokrom ikonu onayla. AAB'yi Play Console'a yükle (internal test,
ardından production). Yeni TestFlight build'ini iPhone'a kur ve iki kez aç.
⚠ Yan etki: runtime değişir. Play'deki 1.0.108 kullanıcıları mağaza
güncellemesini alana kadar OTA alamaz. Production'a yüklemeyi geciktirme.

### ⬜ Faz 5: Component sistemi I

Claude (sayılar Faz 2 ölçümüdür, faz başında yeniden ölçülür):
1. `Chip` (seçilebilir) ve `Badge` (statik): 19 dosyadaki 72 ayrı stil tanımı
   bunlara taşınır.
2. Tek `Sheet`/`ModalScaffold`: kendi `<Modal>`'ını yazan 8 dosya.
3. Tek basma primitive'i: 34 ham `Pressable` → `InstantPressable` (haptik,
   basılı durum, 48dp).
4. Tek başlık: profil hero geri butonu ve kalan özel başlıklar
   `StackScreenHeader`'a geçer.
5. Durum bileşenleri: Loading (skeleton), Empty (yönlendirici CTA), Error
   (insan dili + Tekrar dene), Offline, Partial. Her ekran aynı bileşeni
   kullanır.
6. Form standardı: label, helper, alanın yanında blur'da hata, focus,
   disabled, loading, çift gönderim kilidi, return → sonraki alan, sayaç ve
   maxLength. Uygulandığı yerler: auth, profil düzenleme, liste editörü, mekân
   editörü, yorum.
7. Guard: yeni ham `<Modal>`, `Pressable` ya da chip stili eklenince build
   kırılsın.

Kapanır: — (B9, E28, A4 ve A5'e katkı)
Cayan: —

### Faz 5 kaydı, 1. tur (2026-09-23)

**Teslim:** OTA grupları `91d2198f`, `a4140b77`, `009d531b`, `0e43c6ce`. Her biri
iki soğuk başlatmayla cihazda doğrulandı (`DownloadComplete`, ardından
çalışır hâlde).

| # | Değişiklik | Kanıt |
|---|---|---|
| C1 | Tek basma primitive'i: 65 ham `Pressable`'ın 60'ı basılı tepki vermiyordu; hepsi `InstantPressable` | guard: ham `Pressable` import'u build'i kırar (deneme dosyasıyla kanıtlandı) |
| C2 | `InstantPressable` statik öğeleri artık "buton, pasif" diye duyurmuyor | Keşfet sahip başlığı testi |
| C3 | `Chip`: 5 ayrı seçilebilir hap → 36dp görünür, 48dp dokunma alanı, iki tür | cihaz: Keşfet sekmesi 99px = 36dp; profil filtresi |
| C4 | `Badge`: 14 dosyada 20+ elle yazılmış rozet (18–36dp arası 7 yükseklik) → 24dp, 7 ton | 5 test; cihaz: kart etiketleri, ilgi alanı, liste köşe rozeti |
| C5 | Kapaksız liste detay sayfasında da tasarlanmış kapak; bileşen `shared`'a taşındı | mimari guard |
| C6 | `SheetHeader`: 7 elle yazılmış sheet başlığı → 1 | 214 test |
| C7 | Sheet'ler alta yaslı ve kenardan kenara; takipçi sheet'i scaffold'a geçti, satırlar düz | cihaz ekran görüntüsü |
| C8 | Kart menüsü tek seviye: "İçerik işlemleri" içindeki ikinci "İçerik işlemleri" sheet'i kaldırıldı | cihaz: tek menüde Düzenle/Sil |
| C9 | Menü satırları gri hap yerine düz satır | cihaz |
| C10 | Profil düzenleme: ilgi alanı adımında aynı başlık ve açıklama iki kez yazıyordu | cihaz |
| C11 | Testler: `npm run test` Keşfet klasörünü hiç koşmuyordu; özellik listesi artık diskten okunuyor | 6 gizli kırmızı test bulundu ve düzeltildi |

**🔴 P0: kayıt ve profil kaydı bozuk (production).** `20260830143000`
kullanıcı adı kontrolünü yalnız `service_role`'e açtı. Ama
`public.check_account_availability` çağıranın yetkisiyle çalışıyor ve
içerideki `private` fonksiyona `service_role` ulaşamıyor (production
kataloğunda `service_role`'ün `private` şemasında kullanım yetkisi yok).
30 Ağustos'tan beri her kontrol 500 dönüyor. Sonuç: yeni kullanıcı kullanıcı
adı adımını geçemiyor; mevcut kullanıcı profilini kaydedemiyor.
- İstemci tarafı: kendi mevcut kullanıcı adı artık sunucuya sorulmuyor. OTA
  `a4140b77` ile teslim edildi; profil kaydı cihazda tekrar açık.
- Sunucu tarafı: migration `20260923020000` (sarmalayıcı `SECURITY DEFINER`,
  yetki yalnız `service_role`'de). Yerel stack'te 76 migration ve 11 SQL test
  dosyası (317 test) geçti. Yeni pgTAP testi kontrolü `service_role` olarak
  gerçekten çalıştırıyor. Production'a uygulandı (`supabase migration list --linked`).

**Açık kalan (Faz 5):** form standardı (auth alanı ile `TextField` iki ayrı
implementasyon), durum bileşenleri, kendi `<Modal>`'ını yazan 5 sheet (yorum
işlem sheet'i, medya kaynak seçimi, harita önizleme, liste ve mekân
editörleri), `İptal` başlık aksiyonunun gri dolgusu.

**Faz 7'ye not edilenler:** `FeedActionBar` içindeki hiç tetiklenmeyen ikinci
"yer şikâyet et" yolu (durum hook'u + overlay + test); liste editörü ile mekân
editörünün "yeni liste" formu aynı kapak seçiciyi iki kez yazıyor;
`MediaThumbnailView` ile `VideoPreview` aynı oynat/süre rozetlerini
tekrarlıyor.

**Faz 11'e not edilen:** edge function hata metinleri Türkçe karakter
taşımıyor ("Kimlik dogrulama islemi tamamlanamadi", "Giris islemi…").
Kullanıcıya gösterildikleri yerler taranacak; düzeltme edge function
deploy'u gerektirir.

### Faz 5 kaydı, 2. tur (2026-09-23)

**Teslim:** OTA grupları `00ca5701`, `2b1b5730`, `dc6b3800`, `4c7090e8`; her biri iki soğuk
başlatmayla cihazda doğrulandı (ilkinde indirildi, ikincisinde güncelleme
kalmadı).

| # | Değişiklik | Kanıt |
|---|---|---|
| D1 | Profil: Mekânlar'da aşağı kaydırıp Galeri'ye geçince sekmeler ile ilk öğe arasında ~1300px gri bant. İki kök neden: Android'de bir listeye yenileme kontrolü eklenip kaldırılınca kaydırma görünümü baştan kuruluyor (her sekme geçişinde oluyordu); grid'in ref callback'i her sayfa yüklemesinde yeniden kurulduğu için pager sekmenin konumunu unutuyordu | cihaz: Galeri ilk öğesi sabit sekmelerin hemen altında; geri kaydırmada Mekânlar ve Listeler yerinde. Regresyon testi eski kodla kırmızı |
| D2 | Keşfet: sekme geçişinde boş kare. Kök neden D1 ile aynı | cihaz: geçişten 0,3 sn sonra sekme tam çizili |
| D3 | Profil düzenleme: Kaydet'e basınca form başa atlıyor, klavye kapanıyordu. Kök neden D1 ile aynı | birim testi |
| D4 | Yorumlar YouTube/Reddit düzeninde: kutu yok; ad ve zaman tek satır, metin, sade işlem satırı; yanıtlar "N yanıtı göster" arkasında, 3'erli açılır, "N yanıt daha" son yanıtın altında; yanıt yazmak konuyu açar | cihaz, Cayan'ın kendi gönderisinde: yorum, beğeni, yanıt, gizle/göster, silme (yanıt da gitti). Test içeriği silindi |
| D5 | Yorum menüsü ortak işlem sheet'ine geçti (kutulu satırlar ve kırmızı çerçeveli Sil kalktı) | birim testi |
| D6 | Bildirimler: başlığın üstünde durum çubuğu kadar boşluk (iki kez safe-area); kırpılan kategori hapları ortak `Chip`; "tümünü okundu yap" yalnız okunmamış varken görünür | cihaz |
| D7 | Bildirimler: zaman göreli ("3 sa", "2 gün"); dedupe öncesi iki kez kaydedilmiş beğeni ve takipler listede bir kez (kayıtlar silinmedi) | birim testi; cihaz: liste 20'den 16 bildirime indi, her beğeni bir kez |
| D8 | Paylaşım: `sorita://` bağlantısı WhatsApp ve Instagram'da tıklanamaz düz metindi. Artık web sitesindeki yönlendirme sayfasının HTTPS bağlantısı ve üstünde mekân adı ile şehir paylaşılıyor. Adres tek sabit; bir test onu Supabase `site_url` ile eşit tutuyor | birim testi; cihazda paylaşım sayfası açıldı, gönderilmedi; canlı yönlendirme sayfası 200 dönüyor ve `listId`'yi uygulama bağlantısına çeviriyor |
| D9 | Profil düzenleme başlığındaki `İptal` gri dolgulu kutu yerine düz metin | birim testi |

**Paylaşım önizlemesi (Cayan'ın kararı):** WhatsApp kartı için web sitesine
`og:` etiketleri ve 1200×630 görsel, Android'de uygulamayı doğrudan açan
intent bağlantısı hazırlandı; site repo'suna yazmak izin sisteminde durdu.
İçeriğe özel önizleme (mekân fotoğrafı ve adı, Instagram reels gibi) sunucu
tarafında HTML üretmeyi gerektirir: GitHub Pages bunu yapamaz, Supabase
varsayılan alan adında HTML servis etmez. Bunun için bir Cloudflare Worker ve
bir alan adı gerekir.

**Faz 7'ye not:** `SettingsHeader` ile `StackScreenHeader` iki ayrı başlık
bileşeni.

### Faz 5–9 birleşik tur (2026-09-24)

Cayan fazları sırayla değil birlikte ilerletmeyi istedi; bu tur Faz 5 (bileşen),
Faz 6 (kart ve harita), Faz 9A (durum ve motion) ve Faz 11–19 (işlem matrisi)
kapsamına giren işleri birlikte teslim etti.

**Teslim:** OTA grupları `ec9e1dee`, `102f5293`, `b531e1de`, `316d8a0a`, `0afd4fe6`, `072eb9d6`, `e7404b96`, `330a2fec`; her biri iki soğuk başlatmayla cihazda
doğrulandı (ilkinde indirildi, ikincisinde güncelleme kalmadı).

| # | Değişiklik | Kanıt |
|---|---|---|
| E1 | Profil ve Keşfet 3 sütunlu Instagram ızgarası: kenardan kenara, 2dp aralık, kare görsel, alt geçişte ad, köşede çoklu foto/video/gizli işareti; fotoğrafsız mekânda canlı harita yerine statik harita; Keşfet'te Kişiler liste kalır; yükleme durumu aynı ızgara. Eski kart kutuları ve yalnız onların kullandığı 43 stil silindi (net -1376 satır) | cihaz: Listeler ve Mekânlar ızgarası |
| E2 | Ana Sayfa ve Keşfet üst barı aşağı kaydırınca kayboluyor, yukarıda geri geliyor; en üstte içerikle birlikte hareket ediyor; durum çubuğunu opak şerit örtüyor (şerit native safe area ile boyutlanıyor; hook sekme içinde 0 döndürüyordu) | cihaz: Ana Sayfa'da gizlenme, geri gelme, saat arkasında içerik yok; birim testi (4) |
| E3 | Yorumlar tek istekte: `place_comment_threads_page` artık yazar adı, kullanıcı adı ve fotoğrafını döndürüyor (migration `20260924010000`, pgTAP 6 test, yerel 14 dosya geçti). İstemci satırdaki yazarı önce kullanıyor | birim testi; **production'a uygulanmadı** (izin sistemi) |
| E4 | Yorum beğeni sayısı her yorumda 0 veya 1 görünüyordu (yalnız izleyicinin beğenisinden hesaplanıyordu); artık sunucu sayısı | birim testi |
| E5 | Push uçtan uca izlendi: production'da tetikleyici ve dakikalık gönderici çalışıyor; Xiaomi cihazda uygulama açıkken, arka planda ve sistem öldürmüşken bildirim geldi; zorla durdurulmuşken Android FCM'i iptal ediyor (`result=CANCELLED`). Bildirimler ekranı izin kapalıysa uyarı, bu üreticilerde bir kerelik ipucu gösteriyor; "Bildirim ayarları" doğrudan SoRita kanal sayfasını açıyor (Kayan bildirimler ve Kilit ekranında anahtarları orada, uygulama bunları değiştiremez) | cihaz: 4 test bildirimi (silindi); kanal sayfası açıldı, anahtarlara dokunulmadı |
| E6 | Büyütülen fotoğrafta iki parmakla yakınlaştırma (4x), yakınken tek parmakla gezinme, çift dokunuşla yakınlaştır/geri al; yakınken sayfa kaymıyor; sonraki fotoğrafa geçince sıfırlanıyor; tam çözünürlük gelene kadar küçük görsel | cihaz: çift dokunuş, gezinme, sıfırlama, sayfa geçişi; birim testi (5) |
| E7 | "Adresi göster" açıkken "Adresi gizle" oluyor | basit koşul |
| E8 | Liste sayfasındaki harita dokunulana kadar sabit, sayfa üstünden kayıyor; "Bitti" ile kapanıyor | kod |
| E9 | Keşfet'in 20pt başlığı ve alt yazısı kalktı; profil adı 20pt'den 16pt'ye | cihaz |
| E10 | Galeri sayısı 31 iken "Henüz fotoğraf yok" görünüyordu; sayılmış içerik gelene kadar ızgara iskeleti | cihaz |
| E11 | Galeri ve Keşfet akışlarının üstündeki gri bant (çift safe-area) | cihaz |
| E12 | Izgarada karta dokununca akış o kartta açılıyor, yukarı ve aşağı diğer kartlar (Instagram profil ve keşfet akışı). Önceden hep ilk kartta açılıyordu: dizine kaydırma üstteki kartların ölçülmesini gerektiriyor ve ölçülmeden vazgeçiyordu. Akış artık dokunulan karttan çiziliyor, önceki kartlar o kart yerinde tutularak üste ekleniyor. Profil ile Keşfet'in iki kopya akışı tek `PlaceFeedScreen` | cihaz: Profil > Mekânlar 5. kart (Tostmodern) ve Keşfet > Mekânlar 7. kart kendi yerinde açıldı; yukarı kaydırmada sıra doğru, en üstte ilk kart; birim testi (4) |
| E13 | Uygulama açıkken gelen push artık uygulamanın kendi bandıyla, hangi ekran açıksa üstünde görünüyor: kim, ne yaptı; dokununca ilgili içerik, yukarı kaydırınca ya da 4,5 sn sonra kapanır. Xiaomi, OPPO ve vivo sistem bandını yeni uygulamalarda kapalı tuttuğu için bu bildirimler yalnız bildirim çubuğuna düşüyordu. Bant hazır değilse (oturum yok, açılış sürüyor) sistem sunumu eskisi gibi; iPhone bildirimi Bildirim Merkezi'nde de tutar | cihaz: uygulama açıkken test push'u bant olarak göründü, sistem bildirimi ayrıca düşmedi; banda dokununca Bildirimler açıldı (2 test kaydı silindi); birim testi (5) |
| E14 | Izgaranın ilk ekranı tek seferde çiziliyor. Sekme geçişinde 6 kare ve altında boşluk vardı: ızgara hâlâ canlı harita listesi gibi 2 satırla başlıyordu | cihaz: 34 mekânlık sekmede boşluk |
| E15 | Silinmiş ya da gizlenmiş listede geri çubuğu (iPhone'da çıkış yalnız kenar kaydırmasıydı) | kod |
| E16 | Ana Sayfa üst barı ve durum şeridi kenardan kenara: ekranın 16dp iç boşluğunun içinde kaldığı için iki kenarda gri şerit vardı, logo çift boşlukla içerideydi | cihaz: kenar piksel örneği |
| E18 | Karttan açılan akış ızgaranın üstünde açılıyor, ızgara altta yerinde duruyor: kapatınca aynı kaydırma konumuna dönülüyor (önceden profil en üstten yeniden kuruluyordu). Kendi profilinde akıştan Sil ve Düzenle artık çalışıyor: pencereleri yalnız ızgara görünümünde çiziliyordu, akışta hiçbir şey olmuyordu | cihaz: eski sürümde Düzenle tepkisiz, yenisinde düzenleyici açıldı (kaydedilmeden kapatıldı); geri dönüşte ızgara aynı yerde; birim testi |
| E19 | Akışta Android geri tuşu ızgaraya dönüyor; önceden sekmeden çıkıp Ana Sayfa'ya atıyordu | cihaz |
| E20 | Mekân düzenleyicisi hiçbir şey değişmeden kapatılınca da "Değişiklikler iptal edilsin mi?" soruyordu: taslak fotoğraf listesini ekleyen bir fonksiyondan geçiyor, karşılaştırıldığı başlangıç hali geçmiyordu | cihaz: sorun görüldü; regresyon testi düzeltmesiz kırmızı |
| E17 | Bildirimden açılan listede ilgili mekâna kaydırma: ilk deneme başlık ölçülmeden düşüyordu; her deneme ölçülen en uzak satıra adım atıp yeniden hedefliyor | kod |

**Açık kalan:** yorum migration'ının production'a uygulanması; iOS push
teslimi (iOS token'larından hiç onay yok; iOS cihaz yok); web sitesi önizleme
etiketleri; tek splash (native build, Faz 4); uygulama kapalıyken ekrana
düşme cihaz ayarına bağlı (Kayan bildirimler, Kilit ekranında).

### Faz 4 ve Faz 5–19 birleşik tur 2 (2026-09-24)

Cayan `android/` erişimini ve veritabanı iznini verdi, fazların birlikte
ilerlemesini istedi. Geri alınamaz işlem (silme, düzenleme, hesap) yapılmadı.

**Teslim:** OTA grupları 316d8a0a … 2bdd36bc (önceki tur), 13b `2cd0ae21`, 14 `bf01f42b`, 15 `88cda775`, 16 `77b26b31` (geri alındı → `07f4c7fd`), 17 `6acad2b7`, 18 `47e02bb6`, 19 `118e6da7`; her biri iki soğuk başlatmayla cihazda
doğrulandı.

**Faz 4, native paket #1** (dal `native/faz-4`, main'e alınmadı; OTA'lar
main'den sürmeye devam ediyor):

| # | Değişiklik | Kanıt |
|---|---|---|
| N1 | Tek splash: Android 12+ sistem splash'i ikon göstermiyor, düz zemin doğrudan logolu ve telif yazılı JS splash'ine geçiyor. iOS'ta açılış görseli zaten telif yazılı | cihaz: soğuk açılış karelerinde yuvarlak logo yok |
| N2 | Dikey kilit native'de: manifest `screenOrientation="portrait"`, iOS için `app.config.ts` `orientation: 'portrait'` | config testi |
| N3 | Tema ikonu: logonun silüetinden, 66dp güvenli daireye oturtulmuş tek renkli katman (Android 13+) | önizleme |
| N4 | 1.0.110 (116), iOS 95. Runtime 1.0.108'de kaldı: değişiklikler kaynak dosyası, native modül değil; Play'deki kurulu taban OTA almaya devam eder | native-parity, config testi |
| N5 | Yerel release AAB (`bundleRelease`) üretildi; bundletool ile evrensel APK olarak, veriler korunarak cihaza kuruldu (1.0.110/116); OTA'lar bu kurulumda da iniyor | cihaz: `dumpsys package`, `dev.expo.updates` |

**Düzeltmeler:**

| # | Değişiklik | Kanıt |
|---|---|---|
| G1 | İlk kare: güvenli alan sağlayıcı açılış ölçüleriyle başlıyor; üst bar ve Ana Sayfa şeridi ilk karede saatin altında (önceden bir kare saatin üstüne biniyordu) | cihaz: açılış kare dizisi; birim testi |
| G2 | Önceden dolu tek satırlık alanlar Android'de baştan görünüyor (adres ortasından okunuyordu) | cihaz: mekân düzenleyicisi |
| G3 | Açık akıştayken Profil/Keşfet sekmesine ikinci dokunuş ızgaraya döndürüyor, ızgara yerinde kalıyor | cihaz; birim testi |
| G4 | Gizlilik: "Herkese açık" ile "Gizli hesap" araya analitik girmeden "Profil görünürlüğü" altında | cihaz |
| G5 | Liste haritası ipucu "Bitince Bitti'ye dokun" diyor (olmayan Odakla düğmesini anlatıyordu); Bitti düz beyaz hap | cihaz: etkinleştir, Bitti ile kilitle |
| G6 | Harita önizleme sheet'i alt kenara oturuyor (altında sekme çubuğu şeridi kalıyordu) | cihaz |
| G7 | Uzak karttan açılan akış: Android bazen önceki kartları eklerken başa atıyordu (13. kartta 4'te 2). Ekleme kart oturduktan sonra yapılıyor; liste hâlâ en üstteyse dokunulan karta geri götürülüyor | cihaz: tekrarlı açılış; birim testi (5) |
| G8 | Liste başlığı yerler gelmeden "0 mekân" yerine sunucunun sayısını gösteriyor | cihaz: ilk kareden "2 mekân" |
| G9 | Yorum paneli alt kenara kadar iniyor (yorum kutusunun altında soluk şerit vardı) | cihaz: piksel taraması |
| G10 | Keşfet sayacı aramada "N sonuç", aramasız "N öneri" (haritanın "öneri" metnini ödünç alıyordu) | cihaz: "20 öneri" / "5 sonuç" |
| G11 | Keşfet Kişiler 3'lü ızgarada (Cayan'ın isteği): ortalanmış fotoğraf, ad, kullanıcı adı, küçük Takip et. Keşfet sekme çipleri küçük boy (32dp, 12pt) | cihaz |
| G12 | Haritada POI'ye dokunarak eklenen mekânda iki satırlık etiket boşluksuz birleşiyordu ("StadyumuFenerbahçe"); satır sonu artık boşluk | birim testi |
| G13 | Yorum yazar migration'ı (`20260924010000`) production'da: fonksiyon yazar sütunlarını döndürüyor, anon çalıştıramıyor | production sorgusu |
| G14 | Keşfet araması (Cayan'ın bildirdiği "arama yapamıyorum"): arama alanı sonuç yüklenirken yeniden kurulmuyor (üç harfte klavye kapanıyordu); 1–2 harfte "Biraz daha yaz", sayaç boş; sekme ilk sayfası gelirken iskelet | cihaz: "ka" / "kah"; birim testleri |
| G15 | Keşfet kuralı (Cayan onayladı): arama kutusu boşken yalnız takip edilmeyenlerin önerileri; aramada takip edilenler ve gizli hesaplar da bulunuyor, kendi içeriğin çıkmıyor; alaka katmanı (ad başı > ad içi > diğer alan), eşit eşleşmede takip edilen önde; kategori Türkçe etiketiyle ("kafe") bulunuyor. Migration `20260924020000` + 14 pgTAP | yerel doğrulama PASS; production'a Cayan uygulayacak |
| G16 | Harita araması konuma göre: "kahve" Almanya'dan sonuç getiriyordu (sunucu Frankfurt'ta). Uygulama harita merkezini ~1 km'ye yuvarlayıp gönderiyor; fonksiyon 50 km yanlılık, bölge TR, eşit eşleşmede Google sırası. Eski fonksiyon yeni alanı yok sayıyor | cihaz: Almanya sonuçları görüldü; fonksiyon testleri (17); deploy Cayan'da |
| G17 | Uzun ad dokunulabilir satırda (harita sonucu, liste seçici, kart liste çubuğu, sahip kartı, takipçi/engelli biyografisi) dokunuşu yutup metni açıyordu; artık satır açılıyor | kod incelemesi, cihaz |
| G18 | "@kullanıcı" aramaları (Keşfet Kişiler, takipçiler, beğenenler) @'yi atıyor; vurgu aramayla aynı harf katlamasını kullanıyor ("ist" → "Istanbul", "sukru" → "Şükrü") | cihaz: "@fin"; birim testleri |
| G19 | Adres ve saatler bağlantıya dönüşmüyor: "No:2/B", "Saat:10:00", "Cd.No:12", "vs.Ama" üstü çizili güvensiz bağlantı görünüyordu; şema yalnız "//" veya tehlikeli şemalarda, çıplak alan adı bilinen uzantılarda | cihaz: harita sonucu adresi; birim testleri |
| G20 | Bildirime dokununca mekân görünüme geliyor (liste en üstte kalıyordu: altı hızlı deneme uzun başlıkta bitiyordu); yorum, yorum beğenisi ve yanıt bildirimleri (uygulama içi ve push) yorumları bir kez açıyor; yeniden açılışta tekrar açılmıyor | cihaz: Deniz → Kloft yorumları; birim testleri |
| G21 | Genel liste paylaşılabiliyor (Paylaş, Bağlantıyı kopyala); gizli liste bağlantı sunmuyor; üst bar liste adını gösteriyor; vurgulu kart rozeti "Seçili mekân" | birim testleri |
| G22 | Yeni oturum Ana Sayfa'da açılıyor: ekran yığını 24 saat yerine 30 dk geri yükleniyor | cihaz: soğuk açılış |
| G24 | Çok satırlı notlar Android'de satır sonu yerine kutu çiziyordu: satır sonları U+2028 olarak yazılıyor, Ana Sayfa/liste/profil/Keşfet okuma modelleri çözmüyordu. Dördü de çözüyor; `ExpandableText` ayrıca güvenlik ağı | cihaz: KargArt notu; birim testi |
| G25 | Profil görünürlük filtresi sekmeyi boşaltınca "Henüz listen yok · Yeni liste oluştur" yerine "Özel listen yok" ve "Tümünü göster" | cihaz; birim testi |
| G26 | Ayarlar sonunda kurulu sürüm ("SoRita 1.0.110 (116)"); aynı konum ekranında her kartta tekrar eden, bir yere gitmeyen "Bu konumda 2 kart" satırı kalktı | birim testleri |
| G23 | Listeler kırpmayı (`removeClippedSubviews`) öğe sayısına göre açıp kapatıyordu: Keşfet'te arama ızgarayı boşaltınca boş mesaj çizilmiyordu, satırlar değişirken Fabric "addViewAt index" hatasıyla React'i düşürüp ekranı boşaltabiliyordu. Artık hep kapalı | cihaz: logcat; birim testi |

**Olay:** OTA 16 (`77b26b31`) G23'ün yanlış teşhisiyle ızgaranın konum
korumasını açıp kapatıyordu; cihazda Keşfet aramasında React'i düşürdü.
Aynı dakikada `eas update:rollback` ile OTA 15 içeriğine dönüldü
(`07f4c7fd`), değişiklik geri alındı, kök neden (G23) OTA 17'de düzeltildi.

**Açık kalan (Cayan):** `npx supabase db push --linked` (G15) ve
`npx supabase functions deploy maps-geocoding` (G16); ikisi de bu oturumda
"Production Deploy" olarak reddedildi. Cayan'ın "Chobani
StadyumuFenerbahçe Şükrü…" mekânının adı sahibince düzeltilmeli; iOS push
teslimi (iOS cihaz yok); web sitesi önizleme etiketleri. **Karar bekleyen:**
Ayarlar'a "Yasal" grubu (Kullanım Koşulları, Topluluk Kuralları, Gizlilik,
KVKK; kayıttaki belge sayfası yeniden kullanılıyor) hazırlandı ama
dondurulmuş ürün yüzeyini (3 grup) aştığı için geri alındı. Apple 5.1.1(i)
gizlilik politikasının uygulama içinden erişilebilir olmasını istiyor;
Cayan onaylarsa `quality/feature-surface.snapshot.json` güncellenip eklenir.

### Faz 5–7 birleşik tur 3 (2026-09-25)

Cayan fazların birlikte ilerlemesini ve gözünden kaçan tekrarların
kaldırılmasını istedi; testler yalnız bağlı telefonda (emülatör yok).

**Teslim:** OTA grupları 20 `6c47041f`, 21 `6952424f`, 22 `36f82599`,
23 `a668f3ca`, 24 `001bf52d`, 25 `ad151fb2`, 26 `d8509424`, 27 `d80cdaf7`;
her biri iki başlatmayla cihazda doğrulandı.

| # | Faz | Değişiklik | Kanıt |
|---|---|---|---|
| H1 | 5 | Tek pencere primitive'i: 10 dosya react-native `Modal`'ını aynı ayarlarla yazıyordu; hepsi `AppModal` (kamera opak, medya seçici sistem çubuğunu korur). eslint başka dosyada `Modal` import'unu reddediyor | deneme dosyasıyla guard kanıtı; cihaz: kart menüsü, yer ve liste düzenleyici, yorumlar, harita önizleme, görüntüleyici |
| H2 | 7 (E28) | İki görüntüleyici tek: `ImageLightbox` 330 satırlık ikinci bir görüntüleyiciydi, artık `MediaLightbox`'a veren ince bir adaptör; profil, kapak ve liste kapağı da yakınlaştırılıyor | cihaz: profil fotoğrafı, liste kapağı |
| H3 | 7 (E27) | `tr.ts` (1098 satır) özellik başına 11 dosyaya bölündü; çözümlenen `tr` nesnesinin anlık görüntüsü önce ve sonra bayt bayt aynı; source-health istisnası kalktı | anlık görüntü karşılaştırması; tüm testler |
| H4 | 6 | Haritanın ilk açılış ipucu Google logosunun üstünde; ipucu görünürken renk açıklaması kenara çekiliyor | kod |
| H5 | 9A | Görüntüleyici zemini %40'tan %90 koyuya: açık durum çubuğu simgeleri açık ekranda kayboluyordu | cihaz |
| H6 | 9B | Liste düzenleyici ve kamera/galeri seçimi alt kenara oturuyor (Kaydet altında karartılmış şerit vardı) | cihaz: piksel örneği |
| H7 | 9B | Yer düzenleyici başlığında "İptal" ile X aynı işi yapıyordu; seçim sayfasında da alttaki "İptal" ile X; tek çıkış | cihaz |
| H8 | 9B | "Bağlantı URL'sini kopyala" → "Bağlantıyı kopyala" | cihaz: toast |
| H9 | 5 | `Badge` dokunuşu geçiriyor: kapak üstündeki "Kapağı aç" rozeti dokunuşu yutuyordu | cihaz: rozete dokununca kapak açıldı |
| H10 | 13 | Takibi bırakma onaylı (profil ve Keşfet karosu): düğme "Takiptesin", dokununca "@kullanıcı takibini bırak?"; gizli hesapta yeniden istek gerektiği yazıyor. Takip etme tek dokunuş | birim testleri; gerçek kullanıcıyı etkileyeceği için cihazda basılmadı |
| H11 | 19 | Bildirimde avatar kişinin profilini, satırın geri kalanı içeriği açıyor; ekran okuyucuya satır eylemi | birim testi |
| H12 | 9B | Liste sayfası tekrarları (Cayan): ad ve mekân sayısı yalnız üst çubukta; kartta görünürlük ve tarihler; "Harita" tek etiket; "Mekânlar" üstündeki üçüncü sayı ve tekrar eden ipucu kalktı | cihaz |
| H13 | 9B | Düzenleyici tekrarları: yer düzenleyicide "Şu anda … listesinde" iki kez; liste düzenleyicide başlıkta görünürlük rozeti + görünürlük bölümü; "Seçilen konum" kartı adres alanını tekrar ediyordu (artık adres boşken görünür) | cihaz, kod |
| H14 | 9B | Liste sayfasında "başa dön" düğmesi kartların "…" menüsünü örtüyordu; artık listenin üstünde küçük hap | cihaz: menü açıkta, hap başa kaydırıyor |

**Faz 5 kalanı:** form standardı (auth alanı ile `TextField` birleşmesi;
giriş ekranları hesaptan çıkmadan cihazda test edilemediği için Cayan'la
birlikte), `SettingsHeader`/`StackScreenHeader` birleşmesi, durum
bileşenleri denetimi. **Faz 6 kalanı:** kart varyantlarının tek meta ızgarası,
harita durumları (boş/hata/izin). **Faz 7 kalanı:** en büyük 5 dosyanın
bölünmesi, ölü kod taraması.

### 🔶 Faz 6: Component sistemi II, PlaceCard ve harita

Claude:
1. PlaceCard tek görsel dil: Full, Compact ve Grid varyantları aynı meta
   ızgarasını kullanır. Rating ya da mesafe gibi yeni alan **eklenmez**.
2. Harita UI tek sistem: kontroller, önizleme, sheet, lejant, boş / hata /
   izin yok durumları.
3. Liste detayındaki "Mekân konumları" haritası dikey kaydırmayı yakalıyor.
   Kart haritalarındaki gibi dokununca etkinleşecek.
4. Keşfet karolarında native harita döşemeleri yüklenmiyor. Anahtar kısıtını
   doğrula; gerekirse ana akıştaki gibi statik haritaya geçir.
5. Haritanın ilk açılış ipucu Google logosunu örtüyor, düzelt.

Kapanır: **B9**
Cayan: Google Cloud Console'da Maps SDK anahtarının "Uygulama kısıtı" (paket
adı + SHA-1 / bundle id) ve "API kısıtı" ekranlarının görüntüsünü gönder.
Anahtar değerini paylaşma.

### Faz 6 kaydı (2026-09-25)

| Kalem | Durum | Kanıt |
|---|---|---|
| Harita UI durumları (madde 2) | 🔶 | Veri hatası ve kayıtlı veriyle gösterim, arama hatası ve sonuç yok, konum izni reddedildi (tekrar iste ya da Ayarları aç), konum alınamadı: hepsi `MapPriorityNotice` içinde vardı. Eksik olan boş durumdu: pin filtresi ziyaretler arasında hatırlanıyor, bu yüzden "Tüm pinleri gizle"de ya da pini olmayan bir türde bırakılan harita boş ve açıklamasız açılıyordu. Artık "Pinler gizli" ya da "Bu filtrede pin yok" uyarısı ve "Tümünü göster" eylemi çıkıyor (`7f4ae26`, OTA 39). Cihaz kontrolü telefon bağlanınca |
| Madde 3, 4, 5 | ✅ | Liste haritası dokununca etkinleşiyor, keşif karoları statik harita kullanıyor, ilk açılış ipucu Google logosunu örtmüyor (Faz 5 3. tur, cihazda) |
| Madde 1: ortak görsel dil | ✅ | Kart ailesi ikiye indi: akış ve liste detayında tek `PlaceCardFull`, ızgaralarda tek `MosaicTileFrame` (liste ve mekân karosu aynı çerçeve: görsel, alt geçişte ad, köşede tür işareti). Compact varyant kodda yok (`grep` ile doğrulandı), yeni alan eklenmedi |

### ✅ Faz 7: KISS ve mimari

Claude:
1. E26: katman ihlali taraması (UI → application → data → platform), döngüsel
   bağımlılık, "bir özelliği silince kaç dosya kırılır" testi.
2. E27: 500+ satırlık 28 dosyanın her biri için karar (bölünecek ya da
   gerekçesiyle kalacak). En büyük 5 dosya bölünür: `usePlaceEditorState` 929,
   `listsRepository` 886, `optimisticSocialCache` 872, `media.ts` 856,
   `PlaceCard` 724. `tr.ts` (1098) özellik başına dosyalara ayrılır, metin
   değişmez.
3. E28: iki lightbox tek lightbox olur (329 + 552 satır). Kalan tekrar eden
   kararlar birleştirilir.
4. E29: tek implementasyonlu interface, tek satırı saran wrapper, gereksiz
   context ve state temizlenir. Silinebilir ve birleştirilebilir dosya listesi
   çıkarılıp uygulanır.
5. E32: ölü kod, kullanılmayan bağımlılık ve asset, yorum satırına alınmış kod.

Kapanır: **E26, E27, E28, E29, E32**
Cayan: —

### Faz 7 kaydı: KISS ve mimari (2026-09-25)

**Teslim:** OTA 29 `edba5f19`, 30 `f3b2f409`, 31 `6361be1f`, 32 `1d82a56d`;
her biri iki başlatmayla cihazda doğrulandı (`isUpdatePending` true → false).
Her OTA'da `check:release` yeşil; son grup 1386 test, dal kapsamı %90,31.

**E26 Mimari.** Katman yönü tarandı:

| Yön | İhlal | Koruma |
|---|---|---|
| platform → data / features / app-shell | 0 | tarama |
| data → features / app-shell | 0 | tarama |
| feature UI → repository ya da Supabase | 0 | `architecture:check` |
| özellik → başka özelliğin iç dosyası | 0, hepsi `public/` üzerinden | `architecture:check` |
| shared → features / data | 0 | `architecture:check` |
| shared → app-shell | 1 → 0 | `MediaLightbox` durum çubuğu hook'unu app-shell'den alıyordu. `AppSystemBars` yalnız token'a bağlı olduğu için `shared/components/chrome` altına taşındı. Guard'a kural eklendi; deneme dosyası reddedildi (`5473eed`) |
| döngüsel bağımlılık | 0 | `source-health:check` |

Özellikten app-shell'e 21 dosya gidiyor: navigasyon tipleri, oturum
context'i, ilerleme bandı ve auth yönlendirmesi. Bunlar uygulama çapında
sözleşmeler; kabul edildi.

"Bir özelliği silince kaç dosya kırılır" (onu dışarıdan kullanan dosya,
hepsi `public/` üzerinden): auth 2, discovery 2, explore 1, home 1, lists 1,
map 6, notifications 1, places 7, profile 1, settings 1, social 2.

**E27 Büyük dosyalar.** Bölünenler:

| Dosya | Önce | Sonra | Ayrılan |
|---|---|---|---|
| `tr.ts` | 1098 | 36 | özellik başına 11 dosya; çözümlenen nesne bayt bayt aynı |
| `usePlaceEditorState` | 929 (tek hook 795) | 397 (hook < 300) | `usePlaceEditorListSelection`, `usePlaceEditorSave`, başlangıç durumu `placeEditorStateUtils`'te |
| `useMapScreenState` | 855 (hook 800) | 525 (hook 482) | `useMapEditorSession`, `useMapPlaceSave`, `useMapScreenPersistence` |
| `listsRepository` | 886 | 670 | `listPersistencePayload` |
| `optimisticSocialCache` | 872 | 379 | `optimisticCacheTransforms` |
| `media.ts` | 856 | 625 | `mediaFunctionClient` |
| `images.ts` | 810 | 652 | `pickedMediaFiles` (720p boyutlandırma, küçük görsel) |
| `UserProfileScreen` | 793 | 667 | `useProfileTabPager`, `userProfileOverlays`, `ProfileTabEmptyState` |
| `PlaceCard` | 724 | 678 | `placeCardOverlays`, paylaşılan `DeferredFeedback` |

`source-health` dosya istisnası kalmadı (`HOTSPOT_LIMITS` boş). Fonksiyon
istisnaları yeni boyutlara indirildi: `useMapScreenState` 800 → 490,
`UserProfileScreen` 700 → 560, `ProfileScreen` 590 → 485.

500+ satırlık 32 dosyanın her biri için karar:

| Dosya | Satır | Karar |
|---|---|---|
| `supabase/functions/media-assets/handler.ts` | 2095 | Kalıyor. Edge function tek dosya deploy ediliyor; imza, doğrulama ve yükleme adımları sırayla okunuyor. Bölmek deploy gerektirir (Faz 23, Cayan) |
| `auth-gateway/handler.ts` | 925 | Aynı gerekçe (Faz 23) |
| `moderation-reports/handler.ts` | 762 | Aynı gerekçe (Faz 23) |
| `maps-geocoding/handler.ts` | 588 | Aynı gerekçe |
| `delete-user/handler.ts` | 540 | Aynı gerekçe |
| `useAuthScreenState` | 679 | Faz 5 form standardıyla birlikte; giriş ekranları hesaptan çıkmadan cihazda denenemiyor (Cayan) |
| `PlaceCard` | 678 | Kalıyor: bölümleri zaten `place-card/` altında; kalan gövde kartın durum makinesi |
| `listsRepository` | 670 | Kalıyor: listelerin yazma yolu (oluştur, güncelle, toplu güncelle, sil, şikâyet); yük hazırlama bu turda ayrıldı |
| `ListDetailScreen` | 669 | Faz 9B'de başlık/harita bölümüyle bölünür |
| `UserProfileScreen` | 667 | Kalıyor: bu turda 793'ten indi |
| `ProfileContentPager` | 655 | Kalıyor: üç sekmenin sayfalayıcısı ve başlık kaydırma eşitlemesi |
| `useAuthActions` | 655 | Faz 20 (oturum güvenliği) ile birlikte |
| `images.ts` | 652 | Kalıyor: bu turda 810'dan indi; kalan kısım seçici akışı |
| `CommentPanel` | 634 | Faz 9B (yorum paneli görsel turu) |
| `media.ts` | 625 | Kalıyor: depolama işlemleri (yükleme, özel alana taşıma, silme, imzalı okuma); istemci kısmı bu turda ayrıldı |
| `authSessionLifecycleRuntime` | 609 | Faz 20 |
| `usePlaceCardState` | 582 | Kalıyor: tek kartın durum hook'u |
| `MediaLightbox` | 576 | Kalıyor: tek görüntüleyici (iki görüntüleyici birleşti) |
| `GoogleMapView` | 570 | Kalıyor: native harita sarmalayıcısı |
| `SwipeableTabPager` | 555 | Kalıyor: genel kaydırmalı sekme bileşeni |
| `edgeFunctions.ts` | 554 | Kalıyor: edge function istemcisi (imzalı başlıklar, adres, hata ayrımı); güvenlik kodu tek yerde |
| `AppImage` | 534 | Kalıyor: görüntü bileşeni ve ön yükleme kuyruğu |
| `authSessionSupport` | 534 | Faz 20 |
| `MapScreen` | 527 | Kalıyor: bu turda 603'ten indi |
| `ProfileScreen` | 525 | Kalıyor: bu turda 616'dan indi |
| `useMapScreenState` | 525 | Kalıyor: bu turda 855'ten indi |
| `PlaceEditorModal` | 519 | Kalıyor: bu turda 598'den indi |
| `optimisticCacheTransforms` | 518 | Kalıyor: saf dönüşümler, testli |
| `useSettingsScreenState` | 510 | Faz 12 (ayarlar işlem matrisi) |
| `PlaceEditorFinalStep` | 509 | Kalıyor: son adımın alanları |
| `SettingsScreen` | 502 | Faz 12 |
| `AuthRegisterFlow` | 501 | Faz 5 form standardı |

**E28 DRY.** Birleştirilenler:

| Tekrar | Kopya | Şimdi |
|---|---|---|
| Görüntüleyici | 2 | `MediaLightbox` |
| react-native `Modal` ayarları | 10 | `AppModal` (eslint başka dosyada reddediyor) |
| Video rozetleri | 2 | `VideoBadges` |
| Yığın başlığı | 2 | `StackScreenHeader` (`inline`) |
| Kapak seçici | 2 | `useCoverImagePicker` |
| Liste paylaşım menüsü | 2 | `listShareMenuItems` |
| Akış kartı eşleyici (ana sayfa, Keşfet, profil) | 3 | `mapPlaceFeedCard`; `toNumber` ve `parseMedia` 4 depoda kopyaydı. Depolardan net 430 satır çıktı |
| Profil sekme ve pager mantığı | 2 | `useProfileTabState` + `useProfileTabPager` |
| Profil boş sekme durumları | 2 | `ProfileTabEmptyState` |
| Takipçi/takip metinleri | 2 | `profileConnectionsCopy` |
| Ertelenmiş onay, şikâyet ve görüntüleyici | 2 | `DeferredFeedback` |
| Haritadaki "yeniden aç" hapları | 2 | `MapReopenPill` |
| Yer editörü başlangıç durumu (editör + değişiklik kontrolü) | 2 | `createInitialPlaceEditorFields` |
| Büyük dosya uyarısı | 2 | `OVERSIZED_MEDIA_NOTICE` |
| Nokta adresi arama (harita dokunuşu, POI) | 2 | `lookUpPoint` |
| "Editörü kapat" durum sıfırlama | 5 | `clearEditor` |
| JPEG yeniden kodlama ve temizlik | 2 | `writeJpeg` |
| Aynı gövdeli iki kırpma kontrolü | 2 | `shouldUseNativeEditing` |

**E29 KISS.** Kaldırılanlar: tek satırlık harita sarmalayıcısı `AppMapView`;
FeedActionBar'da açılmayan şikâyet yolu; editörde hiçbir ekranın çağırmadığı
"medyayı değiştir" ve video kapağı düzenleme durumu; yalnız testlerin
kullandığı `photos`/`handleAddPhoto` takma adları; üç kat yeniden dışa
aktarılan `PlaceEditorDraft` ve `mapScreenTypes`; tek kullanıcılı
`FeedActionPanels` barrel'ı; kaydedilip hiç okunmayan bekleyen kayıt
taslağı; iki dalı aynı işi yapan abort kontrolü; iki tarafı da 20 veren
ternary. Editörün 21 `useState`'i tek alan nesnesi oldu.

**E32 Ölü kod.** knip (dosya, bağımlılık, listelenmemiş, binary) temiz; 7
istisnanın hepsi gerekçeli. Yorum satırına alınmış kod: 0. TODO/FIXME: 0.
`assets/` altındaki iki ikon klasörü (96 dosya) main'de referanssız ama
`native/faz-4` dalında `app.config.ts` ve `brandAssets.ts` kullanıyor;
dal main'e alınınca devreye giriyor, silinmedi.

**Bu fazda bulunan ve düzeltilen hatalar:**

| Hata | Kanıt |
|---|---|
| Küçültülüp yeniden açılan yer taslağı X ile sorusuz kapanıyor, yazılanlar kayboluyordu | cihazda görüldü; yeni test düzeltmesiz kırmızı, düzeltmeyle yeşil; OTA 31'de cihazda soru çıkıyor |
| Küçültülmüş editör hapı yazılan adı değil "Yeni mekân" gösteriyordu | cihaz: hap "Taslak" gösteriyor |
| Harita altındaki hap Google logosunu örtüyordu | cihaz: logo hapın üstünde |
| Profilde boş Listeler sekmesi harita iğnesi gösteriyordu | kod: sekme ikonuyla aynı |

**Cihaz:** yer editörü (aç, yaz, adımlar, liste seçimi, çoklu liste ipucu,
dokunulmamış editör sorusuz kapanır, değişmiş editör sorar, küçült ve
yeniden aç), kart menüsü ve silme onayı (geri tuşuyla kapatıldı), profil
sekmeleri, filtre menüsü, açık sekmeye dokununca başa dönüş, başka
kullanıcının profili ve "…" menüsü, takip listesi, harita araması, Keşfet
mekânları, açıklama genişletme. Hiçbir şey kaydedilmedi, silinmedi.

### 🔶 Faz 8: Kod kalitesi II ve E2E altyapısı

Claude:
1. E30: ortam sınıfı (URL, timeout, sürüm) ve iş mantığı sınıfı (sayfa boyutu,
   karakter limiti, retry, TTL, dosya limiti) → Constants. Toplam sayım,
   sınıflandırma ve guard.
2. E31: muğlak isimler, `is/has` önekli boolean, 20+ satırlık fonksiyon, 3+
   parametre, iç içe if, cyclomatic > 10 (eslint `complexity` kuralı),
   TODO/FIXME sayımı.
3. E33 hazırlığı: kritik yerlerde `Date.now` ve `Math.random` enjekte edilir.
4. E34: sunucu yeni alan, null ya da tip değişimi gönderince crash olmaz
   (şema testleri). Bilinmeyen JSON alanları yok sayılır. RPC ve 6 edge
   function için API sözleşme belgesi yazılır.
5. Maestro altyapısı: test hesaplarını ortam değişkeninden okuyan akış
   şablonu, cihaz koşturucusu, kanıt klasörü (ekran kaydı + logcat).

Kapanır: **E30, E31, E34**
Cayan: 3 test hesabı aç: **A** (açık), **B** (gizli hesap olacak),
**C** (Faz 11'de silinecek). Şifreleri bana yazma, kendi terminalinde
`MAESTRO_*` ortam değişkeni olarak tanımla (komutları fazda veririm). İkinci
bir Android cihaz varsa bağla; yoksa bu makineye emülatör kurulmasına onay ver.

### Faz 8 kaydı, 1. tur (2026-09-25)

Test hesabı gerektirmeyen kalemler yapıldı; teslim OTA 32 `1d82a56d`.

| Kalem | Durum | Kanıt |
|---|---|---|
| E30 hardcode | 🔶 | Uygulama kodunda sayı yazılmış `setTimeout`/`setInterval` gecikmesi yok (yalnız test yardımcıları); `staleTime`/`gcTime` sabitlerde; modül düzeyinde 189 adlandırılmış sayısal sabit. Stil dosyalarında token dışı 38 boşluk değeri var, çoğu 0 ve ±1–2 px optik düzeltme: Faz 9A'daki 4pt ızgara ölçümüne (B12) bırakıldı. Kalan: ortam/iş kuralı sabitlerinin sınıflandırma tablosu ve guard |
| E31 isimlendirme ve karmaşıklık | 🔶 | Karmaşıklık > 10 olan fonksiyon 186 → 184; en yüksek 35 → 30. En yoğun altısı sadeleşti: `ExpandableText` 35 → 23, `TextField` 32 → 18, `MapScreen` 34 → 24, `PlaceEditorModal` 33 → < 25, `UserProfileScreen` 34 → < 25, `PlaceCard` 31 → 27. ESLint sınırı 35 → 30 (`0b0bf74`). TODO/FIXME: 0. `max-depth` 5 kuralı zaten var. Kalan: 21–30 arasındaki 37 fonksiyon; boolean önekleri ve parametre sayısı ölçülmedi |
| E33 hazırlığı | 🔶 | Uygulama kodunda `Math.random` yalnız `withRetryJitter`'da ve enjekte edilebilir (üç push denetleyicisindeki kopyalar birleşti); dört dosya adı üreticisi `createUuid` kullanıyor (`4a857ea`). `Date.now` (74 kullanım, çoğu zaman damgası) enjekte edilmedi: birim testlerinde Vitest sahte saati zaten kontrol ediyor, Maestro ise çalışan uygulamaya saat enjekte edemiyor; göreli zaman fonksiyonu `now` parametresi alıyor. Kalan: yok, karar kaydı bu |
| E34 şema dayanıklılığı | 🔶 | Akış kartı eşleyicisinin testi: sayı yerine metin, null, bozuk medya JSON'u, bilinmeyen alan, sahipsiz satır, izleyicisiz beğeni; hiçbiri çökmüyor. Sözleşme belgesi: `docs/api-contracts.md` (6 edge function, 18 RPC, ortak imza/hata kuralları, alan değiştirme kuralı). Kalan: diğer eşleyicilerin şema testleri |
| Maestro altyapısı | ⏸ | Test hesapları (A, B, C) Cayan'dan bekleniyor |

Yeni doğrudan testler: `ExpandableText` (5), `TextField` (5),
`placeFeedCardMapper` (5). İkisi yeniden düzenlemeden önce eski koda karşı
yazıldı.

### ⬜ Faz 9A ve 9B: durum matrisi, motion, cila / premium görsel tur

Claude:
1. 12 production ekranı için birincil ve ikincil aksiyon, yoğunluk ve ritim
   incelemesi, önce/sonra görüntüleriyle.
2. A4: 12 ekran × 6 durum (loading, empty, error, offline, partial, success)
   cihazda test edilir: uçak modu, boş hesap, sunucu hatası ve kısmi hata
   simülasyonu.
3. A1: ilk anlamlı ekrana kadar geçen süre, boş hesabın ekranları, karşılama
   anı.
4. A2: en sık yapılan işin dokunuş sayısı, çıkmaz sokaklar, aktif sekme ve
   başlık.
5. B14: süre ve easing token'ları, ekran geçişleri, liste ekleme/silme
   animasyonu, her animasyonda Reduce Motion.
6. B15: haptik haritası (başarı, hata, seçim) ve sessiz moddaki davranış.
7. B16: 16 maddenin her biri cihazda kontrol edilir. Sayaç animasyonu,
   splash → ilk ekran geçişinde beyaz flaş, layout shift.
8. B12: 4pt ızgarada son ölçüm, kenar boşlukları, optik hizalama.
9. A6 ilk tur: `tr.ts`'nin tamamı taranır. Sen/siz tutarlılığı,
   "Bir hata oluştu" yasağı, eylem bildiren buton metinleri, yıkıcı işlem
   onayları.

Kapanır: **A4, B12, B14, B15, B16**
Cayan: ekran kayıtlarını izleyip görsel onay ver (10 dk).

### 🔶 Faz 10: Android cihaz uyumu ve erişilebilirlik

Claude:
1. C17: aynı telefonda `wm size`/`wm density` ile 360, 393, 411 ve 480dp
   ve kısa ekran. Her ekran ve klavye açık hali.
2. C20: yazı ölçeği 1.0, 1.3 ve 2.0. `maxFontSizeMultiplier` politikası ve
   taşan kapsayıcılar.
3. C19: TalkBack ile uçtan uca tüm ana akışlar. İkon butonlarının etiketi,
   odak sırası, canlı bölge duyuruları. `accessibility-report` yeniden üretilir.
4. A3 Android: her ekran, sheet ve modalda donanım geri tuşu; form terk
   uyarısı; arka plan/ön plan geçişi; ekran kilidi; bildirim paneli.
5. A7: 5 izin (konum, kamera, fotoğraf, mikrofon, bildirim). İzin öncesi
   açıklama, ihtiyaç anında sorma, reddedince uygulamanın kullanılabilir
   kalması, "bir daha sorma" → ayarlara yönlendirme. Mikrofon izni gerçekten
   kullanılıyor mu, kontrol edilir.
6. C18 Android: edge-to-edge, ripple ve basılı durum, native paylaş/diyalog.

Kapanır: — (C17–C20, A3 ve A7'nin Android satırları; iOS satırları Faz 26'da)
Cayan: —

### Faz 10 kaydı, 1. tur (2026-09-25)

| Kalem | Durum | Kanıt |
|---|---|---|
| A3 donanım geri tuşu | 🔶 | Haritada pin menüsü açıkken geri tuşu önceki sekmeye geçiyor, dönüşte menü açık kalıyordu. Artık önce menüyü, sonra açık arama sonuçlarını kapatıyor; profildeki görünürlük menüsü de öyle (`useAndroidBackHandler`, OTA 34, cihazda iki ekranda denendi). Değiştirilmiş yer editöründe geri tuşu önce klavyeyi kapatıyor, sonra "Değişiklikler iptal edilsin mi?" diye soruyor (cihazda). Kalan: bütün ekran, sheet ve modal matrisi |
| C17, C19, C20 | ⏸ | Ekran boyutu (`wm size/density`), yazı ölçeği ve TalkBack telefonun sistem ayarını değiştiriyor; Cayan onay verirse yapılır, sonra ayarlar geri alınır |

### ⬜ Faz 11–19: İşlem matrisi

Her fazda Claude şunları yapar:
1. Envanterdeki işlemleri koddan yeniden doğrular. Eksik işlem çıkarsa
   envantere eklenir.
2. Her işlem için bir Maestro akışı yazar (otomatikleşebilen kontroller için).
3. Her işlemi aşağıdaki 8 kontrolden geçirir ve sonucu tabloya ✅ / 🔴 / N/A
   olarak işler.
4. 🔴 çıkan her hücre için kök nedeni bulur, düzeltir ve regresyon testi
   ekler. Ardından OTA, cihaza teslim kanıtı ve tekrar kontrol.
5. Hücre ancak cihaz kanıtıyla ✅ olur.

Kontroller:

| Kod | Kontrol |
|---|---|
| T1 | Uçtan uca çalışıyor (Android cihaz); sonuç sunucuda doğrulanıyor |
| T2 | Kalıcılık: uygulama öldürülüp açılınca ve diğer hesaptan bakınca sonuç aynı |
| T3 | Hızlı tekrar dokunuş tek sonuç veriyor (idempotency) |
| T4 | Uçak modu ve sunucu hatasında insan dilinde mesaj + Tekrar dene ya da kuyruk; bağlantı gelince doğru senkron |
| T5 | Yetki: diğer hesap, engelli kullanıcı, gizli hesap ve API'ye doğrudan istek (IDOR) |
| T6 | Geri bildirim: basılı durum, loading, haptik; sayaçlar ve ekranlar arası cache tutarlı |
| T7 | Erişilebilirlik: TalkBack etiketi, 48dp hedef, odak |
| T8 | Yan etki: tek ve doğru bildirim/push, sayaçlar, ilgili ekranlar tazeleniyor |
| iOS | Aynı işlem iPhone'da (Faz 26 senaryosunda) |

"Sıfır hata" kanıtlanabilen bir şey değildir. Kanıtlanabilen şudur: 84 işlemin
her kontrolü tek tek geçti ve kaydı var. Bu da **bilinen sıfır hata** demektir.

Faz 11–19'da Cayan'dan beklenenler faz listesinde yazıyor. Ben şifre girmem,
hesap açmam, hesap silme onayı vermem. Bu adımlar senindir.

### 🔶 Faz 20: Güvenlik ve kötüye kullanım

Claude:
1. G41: refresh token tek uçuşta mı, kilit mekanizması, çıkışta sunucu
   tarafında iptal, oturum süresi dolunca davranış.
2. G42: log ve Sentry olaylarında token ya da kişisel veri taraması
   (`beforeSend`). Android `allowBackup` ve iOS yedekleme dışlaması.
3. G43: yerel Supabase'de persona matrisi (anonim, A, B, engelli, gizli
   hesabın takipçisi) × her tablo, RPC ve bucket. Otomatik IDOR testleri.
   Sunucu tarafı rate limit (429) kanıtı. Girdi doğrulaması ve içerik filtresi
   sunucuda da çalışıyor mu (şu an `contentModeration.ts` istemcide). Upload
   tip, boyut ve içerik kontrolü sunucuda mı. Deeplink ile yetkisiz ekran açılıyor mu.
4. G44: release APK'de R8/minify kanıtı. Katalog ekranının `__DEV__` ile
   kapalı olduğu kodda doğrulandı, release build'de de doğrulanacak. Pano
   kullanımı. Ekran görüntüsü engeli gerektiren ekran var mı.
5. G46: kayıt, içerik ve yorumda spam ve bot sınırları. Bildir/engelle
   akışları (Faz 13'ten). Filtre listesinin yanlış pozitifleri. Moderasyon
   runbook'u: admin panel yok kararı korunur, şikâyetler Supabase paneliyle
   24 saat içinde işlenir.

Kapanır: **G41, G42, G43, G44, G46**
Cayan: SSL pinning kararı (önerimi gerekçesiyle yazarım). Şikâyetlere kimin,
ne kadar sürede bakacağı.

### Faz 20 kaydı, 1. tur: kodda doğrulananlar (2026-09-25)

| Kalem | Durum | Kanıt |
|---|---|---|
| G42 log ve yedek | 🔶 | Android manifest: `allowBackup="false"`, SecureStore için yedek ve veri çıkarma dışlama kuralları. Sentry `sendDefaultPii: false`; bu turda `beforeSend` ve `beforeBreadcrumb` eklendi: e-posta, oturum token'ı (JWT) ve URL sorgusundaki gizli değerler (imzalı depolama adresinin `token`'ı) gönderilmeden temizleniyor. Uygulama logger'ı ile aynı modül (`8f9da5c`, OTA 35). Kalan: iOS yedekleme dışlaması (Faz 26) |
| G44 release sertleştirme | 🔶 | `android.enableMinifyInReleaseBuilds=true` (`gradle.properties`) ile release'de R8 açık; APK üzerinde doğrulama Faz 25'te. Pano: uygulama yalnız kullanıcının "kopyala" eylemiyle yazıyor (paylaşım bağlantısı, adres, yorum), panodan okumuyor. Ekran görüntüsü engeli gerektiren ekran bulunmadı: uygulama ödeme, kimlik belgesi ya da tek kullanımlık kod göstermiyor |
| G41, G43, G46 | ⬜ | Test hesapları ve yerel Supabase persona matrisi gerekiyor (Faz 8 hesapları, Cayan) |

### 🔶 Faz 21: Veri, durum, ağ

Claude:
1. F35: race condition (eski yanıtın yeniyi ezmesi), stale data, cache
   invalidation haritası, prop drilling.
2. F36: tek HTTP katmanı, 401/403/404/409/422/429/5xx için ayrı davranış,
   eşzamanlı 5 istekte tek refresh, timeout, backoff + jitter, ekran
   değişince istek iptali, cursor pagination (tekrar ya da atlama testi).
3. F37: 12 ekranın uçak modu tablosu, bağlantı gelince tazeleme, yerel depo
   şeması ve migrasyonu, TTL, depolamanın sınırsız büyümemesi.
4. F38: idempotency anahtarları, outbox birleşme ve çakışma kuralı,
   optimistik güncelleme başarısız olunca rollback, sunucu ile cihaz saati
   farkı.
5. F40: UTC dönüşümü, göreli zamanın canlı güncellenmesi, DST, `Intl` ile
   biçimlendirme.

Kapanır: **F35, F36, F37, F38, F40**
Cayan: —

### Faz 21 kaydı, 1. tur: kodda doğrulananlar (2026-09-25)

| Kalem | Durum | Kanıt |
|---|---|---|
| F35 eski yanıtın yeniyi ezmesi | 🔶 | Harita araması her isteğe artan kimlik veriyor ve yalnız son isteğin sonucunu yazıyor (`useMapSearchController`). Keşfet araması (300 ms debounce) ve kullanıcı adı kontrolü React Query anahtarında sorguyu taşıyor, geç gelen eski yanıt başka anahtara yazılıyor. Kalan: cache invalidation haritası |
| F36 hata ve yeniden deneme | 🔶 | `queryClient`: 400, 401, 403, 404, 409 ve 422 yeniden denenmiyor; 429 ve 5xx iki kez, diğerleri bir kez; `Retry-After` başlığına uyuluyor. Kullanıcı mesajı zaman aşımı ve bağlantı hatasını ayrı tanıyor, gerisinde ekranın kendi metni. Kalan: aynı anda 5 istekte tek token yenileme kanıtı (test hesabı) |
| F37 çevrimdışı | ⏸ | Çevrimdışı göstergesi ve outbox var. 12 ekranın uçak modu tablosu telefonun sistem ayarını değiştirmeyi gerektiriyor (Cayan onayı) |
| F38 idempotency ve geri alma | ⏸ | Test hesaplarıyla (Faz 11–19 işlem matrisinde T3, T4) |
| F40 zaman | 🔶 | Sunucu ISO/UTC gönderiyor, gösterim cihazın yerel saatinde; hesap epoch milisaniyesiyle yapıldığı için yaz saati kayması etkilemiyor. Cihaz saati sunucunun gerisindeyse gelecekteki zaman "şimdi" okunuyor, eksi değer çıkmıyor. 7 günden eskisi takvim tarihi (`gg.aa.yyyy`). Göreli etiketler canlı saymıyor, ekran yenilenince güncelleniyor; MVP için yeterli |

### 🔶 Faz 22: Performans

Claude:
1. D21: Android cold start, `am start -W` ile 10 ölçüm (medyan ve p90).
   Splash'teki senkron iş, ağır import'lar, ana ekranda istek şelalesi,
   Hermes, bundle ve indirme boyutu. iOS cold start Sentry app-start
   ölçümünden alınır.
2. D22: liste sanallaştırma, key stabilitesi, `getItemLayout`, render içinde
   pahalı iş, `gfxinfo` ile jank, görsel downscale. Her `useMemo` ve
   `useCallback` gerekçelendirilir.
3. D23: 10 dakikalık oturumda `meminfo` grafiği, listener ve timer
   temizliği, görsel önbellek sınırı.
4. D24: ekran başına istek sayısı, N+1, debounce ve iptal, optimistik
   gecikme, prefetch, gzip, yüksek gecikme simülasyonu.
5. D25: arka planda konum ve sensör, polling, `batterystats`.

Kapanır: **D21, D22, D23, D24, D25**
Cayan: iPhone'da uygulamayı 10 kez tamamen kapatıp aç.
⚠ Risk: Redmi Note 9 Pro orta-alt segment bir telefon. 2 saniyenin altı
tutmazsa yapılacak işleri ve dürüst puanı yazarım.

### Faz 22 kaydı, 1. tur: Android ölçümleri (2026-09-25)

Cihaz: Redmi Note 9 Pro (orta-alt segment), release build, OTA 32/33.
Bütçeler `shared/performance/budgets.ts` içinde (p75).

**D21 soğuk açılış.** `am start -W -S` ile 10 ölçüm; aynı açılışların
logcat damgaları:

| Aşama | Medyan | p90 | Bütçe |
|---|---|---|---|
| Süreç → JS `Running "main"` | 695 ms | 738 ms | — |
| İlk kare (`Displayed`, `TotalTime`) | 792 ms | 844 ms | 2500 ms |
| Arayüz ağacı kuruldu (ilk RNScreens satırı) | 995 ms | 1096 ms | 2000 ms (ilk içerik) |

Önbellek soğukken ilk açılış 1114 ms. Hermes ve bridgeless açık. İzde
`expo-updates` başlangıç kontrolü 160 ms sürüyor ve JS paketi ondan ~40 ms
sonra yüklenmeye başlıyor; `fallbackToCacheTimeout: 0` ağın beklenmemesi
demek, bu gecikmenin kontrole bağlı olup olmadığı 2. turda ayrı izle
bakılacak. iOS ölçümü Faz 26'da (Cayan'ın iPhone'u).

**D22 kaydırma.** `gfxinfo` (sentetik `adb` kaydırması):

| Ekran | Kare | Takılan | p50 | p90 | p99 |
|---|---|---|---|---|---|
| Ana sayfa akışı | 1253 | %5,83 | 10 ms | 13 ms | 42 ms |
| Keşfet | 327 | %2,45 | 7 ms | 9 ms | 23 ms |
| Profil | 841 | %7,61 | 14 ms | 16 ms | 24 ms |

`framestats` ile kare aşamaları (son 120 kare, medyan/p90): toplam 9–11 /
11–14 ms; UI thread hiç yavaş değil, en büyük pay GPU komutları (2,6–4,1
ms). Sürekli kaydırma 16,6 ms'nin altında; takılan karelerin çoğu sekmenin
ilk açılışında ve görsellerin ilk çözülmesinde. Ana sayfa ve profil %5
bütçesinin biraz üstünde: Faz 22 2. turda ızgara küçük görselleri ve ilk
görüntülemede görsel sayısı ele alınacak.

**D23 bellek.** Aynı rotada tur başına `meminfo`:

| Durum | Toplam PSS |
|---|---|
| Başlangıç (birkaç sekme gezildikten sonra) | 584 MB |
| 6 tur (Ana sayfa, Keşfet, Profil, Harita) | 821 MB |
| Haritasız 4 tur | 830 → 778 MB (düz) |
| Haritaya 6 kez gidip dönmek | 778 → 986 MB |

Büyüme haritada: her harita ziyareti yaklaşık 96 native görünüm, 25 MB native,
10 MB Java ve 13 MB grafik belleği ekliyor; görünümler pencereye bağlı değil
(`dumpsys activity top` değişmiyor), yani bırakılmamış nesneler.

Denenen düzeltme (OTA 33 `495c1851`): harita ilk ziyarette kurulup
tutuldu. Sızıntı durmadı (241 → 571 MB, 6 ziyaret) ve daha kötüsü, sekmeden
dönünce haritadaki bütün pinler kayboldu. OTA 32 yeniden yayınlanarak geri
alındı (`e076ba6f`, cihazda pinler geri geldi), kod da geri çevrildi
(`f26f4be`).

**Sonuç: sızıntı yok.** Her ölçümden önce çöp toplama zorlanınca
(`am dumpheap`) 20 harita ziyaretinde bellek düz kaldı: toplam PSS 273 →
278 MB, görünüm sayısı 593 sabit, grafik belleği değişmedi, uygulama
çökmedi. Önceki büyüme toplanmamış çöptü; `meminfo` henüz toplanmamış
nesneleri de sayıyor. OTA 33 denemesi bu yüzden gereksizdi ve geri alındı;
harita kodu OTA 32'deki gibi.

**D25 arka plan.** Harita dışındayken uygulamanın konum isteği, alarmı ve
wakelock'u yok (`dumpsys location/alarm/power`).

### Faz 22 kaydı, 2. tur: ana sayfa kaydırması (2026-09-25)

**Ölçüm yöntemi düzeltildi.** Aynı ekranda art arda ölçümler çok oynuyor:
ana sayfa bir oturumda %6,1, diğerinde %8,9 ve %11,4. İki tuzak bulundu:

- `uiautomator dump` (ekranda ne olduğunu okumak için) bir erişilebilirlik
  istemcisi bağlıyor ve bir süre bütün kareleri yavaşlatıyor: profil aynı
  kaydırmada %3,7 yerine %40,9 çıktı. Ölçümden hemen önce kullanılmıyor.
- `adb input` ile gönderilen dokunuşlar neredeyse her karede "High input
  latency" sayılıyor; bu sütun yok sayılıyor.

Temiz ölçüm (ısınma kaydırmasından sonra, OTA 37):

| Ekran | Kare | Takılan | p90 | p99 | Yavaş UI thread | Yavaş görsel yükleme |
|---|---|---|---|---|---|---|
| Profil | 1032 | %3,68 | 12 ms | 20 ms | 1 | — |
| Ana sayfa | 739–781 | %8,9–11,4 | 15–18 ms | 38–40 ms | 12 | 4–5 |

**Kaynak.** Ana sayfa kartı büyük: sahip başlığı, kaynak ve liste çubukları,
fotoğraf karuseli, mini harita. İki gereksiz iş vardı:

1. Kart görünür alandan çıkınca statik haritasını bırakıyordu. Bu bütün kartı
   yeniden çizdiriyor, geri dönüşte harita görseli yeniden çözülüyordu.
2. Karusel, kart kurulur kurulmaz bütün fotoğrafları çözüyordu.

**Düzeltme** (`8028a69`, OTA 38): görünürlük deposu artık görülen kartı
hatırlıyor, bu yüzden her satır görünürlük için en fazla bir kez yeniden
çiziliyor ve harita bir kez yükleniyor. Karusel yalnız gösterilen fotoğrafı ve
iki komşusunu çözüyor; diğer sayfalar aynı boyutta boş.

**Sonuç:** cihaz ölçümü telefon yeniden bağlanınca (telefon bu oturumda USB'den
düştü).

### ⬜ Faz 23: Backend ve gözlemlenebilirlik

Claude:
1. H47: sık çağrılan RPC'lerde `EXPLAIN ANALYZE` (yerelde 10 bin kullanıcı ve
   100 bin kartlık tohum veriyle), eksik indeks, N+1 sorgu, medya + CDN,
   push kuyruğu, trafik 10x olunca maliyet eğrisi.
2. H48: global handler, yakalanmamış promise reddi, parse hatası. Android
   source map ve iOS dSYM yüklemesinin kanıtı: sembolize edilmiş gerçek bir
   test olayı.
3. H49: crash-free oranı, log seviyeleri, performans izleme, alarm kuralları,
   sürüm bazlı karşılaştırma.
4. H50: PostHog olay sözlüğü, ekran görüntüleme ve huni olayları,
   isimlendirme, anonim → kayıtlı birleşmesi, analitik kapalıyken sıfır olay.

Kapanır: **H47, H48, H49, H50**
Cayan: Sentry salt-okur API token'ı ya da alarm ekranlarının görüntüsü,
Supabase Reports ekranı, PostHog olay listesi.

### 🔶 Faz 24: CI/CD, sürüm, bağımlılık, belgeleme

Claude:
1. H51: CI hattı, ortam ayrımı (dev, preview ve prod config; ayrı bundle id
   kararı), branch koruması ve zorunlu kontroller, semver + otomatik build
   numarası, EAS submit.
2. E33: kritik 5 akışın Maestro E2E'si CI'da her gece koşar (Android
   emülatör + yerel Supabase).
3. H52: zorunlu güncelleme / minimum sürüm kontrolü şu an yok, karar
   sunulur. EAS Update kademeli yayın (rollout yüzdesi) ve geri alma provası.
   Play staged rollout planı.
4. H53: `npm audit`, terk edilmiş paketler, aynı işi yapan çift paketler,
   GPL/AGPL lisanslar, native sürüm çakışmaları.
5. H54: README (kurulum, env, build), temiz klonda yeni geliştirici provası
   (süre ölçülür), ADR'ler, API sözleşmesi, CHANGELOG, sırların nasıl
   alınacağı.

Kapanır: **E33, H51, H52, H53, H54**
Cayan: GitHub'da main için branch korumasını aç. Zorunlu güncelleme için
evet/hayır kararı.

### Faz 24 kaydı, 1. tur (2026-09-25)

| Kalem | Durum | Kanıt |
|---|---|---|
| H51 CI | 🔶 | GitHub'da main'e her push'ta iki iş akışı koşuyor. **Quality** (`check:release` + bütün geçmişte Gitleaks) `8f9da5c`'den beri kırmızıydı: redaksiyon testindeki JWT biçimli sabit yakalanıyordu. Parmak izi `.gitleaksignore`'a eklendi, token artık çalışma anında kuruluyor, ignore sayısını sabitleyen test 5'e çıktı (`668018d`, `2b3afd7`); Quality yeşil. **CI**'nin son işi ("Release gates green") main'de kırmızı, çünkü EAS build ve cihaz benchmark işleri `ENABLE_EAS_PREVIEW_BUILDS` / `ENABLE_ANDROID_DEVICE_BENCHMARKS` depo değişkenleri kapalı olduğu için atlanıyor. Bu bir kod hatası değil, EAS kredisi kararı (Cayan). Zamanlanmış **Uptime SLO Probe** `SORITA_UPTIME_HEALTH_URL` tanımlı olmadığı için her gün kırmızı (Cayan). Branch koruması Cayan'da |
| H52 güncelleme ve geri alma | 🔶 | Geri alma gerçek bir olayla prova edildi: OTA 33 dönüşte haritadaki pinleri kaybettirdi, OTA 32 yeniden yayınlanarak geri alındı (`e076ba6f`), cihazda pinler geri geldi. Her yayın `ota:publish` üzerinden `check:release` geçerek çıkıyor ve geri alma komutunu yazıyor. Zorunlu güncelleme / minimum sürüm kararı Cayan'da |
| H53 bağımlılıklar | 🔶 | `npm audit --omit=dev`: 4 orta bulgu, hepsi aynı kayıt (GHSA-vcc3-ghjq-m6fr: React Navigation 6 → query-string 7 → `decode-uri-component` 0.2.2, bozuk %-kaçışında üstel süre). Düzeltilmiş sürüm yalnız ESM olduğu için zorla konamıyor. Bağlantı yapılandırması artık `decodeURIComponent`'in reddettiği yolları açmıyor; yavaş yola ulaşan tek girdi buydu (`bdb8fd8`, OTA 40). Kalıcı çözüm React Navigation 7 yükseltmesi (MVP sonrası). Geliştirme bağımlılıklarında 1 yüksek (`smol-toml`, knip'in; yalnız depodaki TOML'u okuyor) ve 2 orta: `npm audit fix` onaylanmamış kurulum betikli paketleri yeniden kuracağı için dokunulmadı |
| H54 belgeler | 🔶 | CHANGELOG Eylül OTA'larını kapsıyor (`e27c131`), API sözleşmesi `docs/api-contracts.md` (E34). Kalan: temiz klonda kurulum provası |
| E33 Maestro | ⬜ | Test hesapları gerekiyor (Faz 8, Cayan) |

### 🔶 Faz 25: Native paket #2, store ve yasal

Claude:
1. Native: predictive back (A3 doğrulandıktan sonra), Android 15+
   edge-to-edge, güncel `targetSdk`, birikmiş diğer native kalemler.
2. iOS: `PrivacyInfo.xcprivacy` ile kodun karşılaştırması (required reason
   API'ler; Sentry, Firebase ve PostHog manifestleri), `Info.plist` izin
   metinleri, alfasız ikon, ATT gereksinimi (IDFA yoksa N/A kanıtı), Apple
   1.2'nin dört şartı: filtre, bildir, engelle, iletişim.
3. Android: AAB, Data Safety ile kodun karşılaştırma tablosu, hassas izin
   gerekçeleri, adaptive + monokrom ikon, R8 mapping yüklemesi, içerik
   derecelendirme cevap taslağı.
4. G45: veri envanteri (alan → amaç → saklama süresi), üçüncü taraf SDK veri
   tablosu, analitiğe kişisel veri gitmediğinin kanıtı, silme ve dışa aktarma
   uçtan uca, yaş kapısı.
5. I58: KVKK aydınlatma metni, açık rıza metni ve kullanım şartları taslağı.
   Şikâyet ve kaldırma süreci. Uygulama içinde ve store'da aynı URL.
6. Mağaza taslağı: ekran görüntüleri (6.9", 6.5" ve Play), App Review notları,
   yaş derecelendirme cevapları.

Kapanır: **G45, I55, I56, I58**
Cayan: App Store Connect (App Privacy, yaş) ve Play Console (Data Safety,
içerik derecelendirmesi) formlarını taslağımla doldur. KVKK ve şartlar
metnini hukukçuya ya da kendine onaylat. Gizlilik URL'ini yayınla. Review
notlarına test hesabını gir. Yeni AAB'yi Play'e, iOS build'ini App Store
Connect'e yükle.

### Faz 25 kaydı, 1. tur (2026-09-25)

| Kalem | Durum | Kanıt |
|---|---|---|
| I58 yasal metinler uygulamada | 🔶 | Ayarlar'da "Yasal" grubu: Kullanım Koşulları, Topluluk Kuralları, Gizlilik Politikası, KVKK Aydınlatma Metni. Kayıtta onaylanan metinlerin aynısı açılıyor, geri tuşu kapatıyor (OTA 36, cihazda). Cayan 2026-09-25'te MVP gereği olarak onayladı; feature-surface 4 grup / 26 eylem. Ayarlar'daki "Gizlilik" satırı politika ile karışmasın diye "Hesap gizliliği" oldu (OTA 37, cihazda). Kalan: hukuk onayı ve store'da aynı URL (Cayan) |
| Android bildirim ikonu | 🔶 | Dal `native/faz-4` (`d750488`): durum çubuğunda beyaz kare yerine tek renkli SoRita işareti (5 yoğunluk), vurgu rengi `#2563eb`, Firebase ve expo-notifications varsayılanları manifestte. Kalan: Play yüklemesi (Cayan) |
| Diğer maddeler | ⬜ | iOS gizlilik manifesti ve Data Safety karşılaştırması, store taslağı, predictive back, edge-to-edge |

### ⬜ Faz 26: iOS cihaz turu

Mac yok, bu yüzden iPhone'u ben süremem. Claude şunları hazırlar: 84 işlemin
iOS satırı; VoiceOver turu; en büyük Dynamic Type + Bold Text + Increase
Contrast + Reduce Motion; 375pt genişlik için Display Zoom; kenardan kaydırarak
geri; APNs push (uygulama açık, arka planda ve kapalıyken); universal link;
izinler. Her biri adım adım senaryo olarak yazılır. Gelen kayıtları kare kare
puanlarım, bulguları düzeltip OTA ile tekrar gönderirim.

Kapanır: **A3, A7, C17, C18, C19, C20, I57**
Cayan: senaryoyu iPhone'da uygula ve ekran kayıtlarını gönder (2–3 saat,
iki oturuma bölünebilir). Mümkünse küçük ekranlı bir iPhone (SE) ödünç al.

### ⬜ Faz 27: Olgunluk, due diligence, J-Sosyal

Claude:
1. J-Sosyal: akış sıralaması, yeni içerik gelince sayfalamanın tekrar ya da
   atlama yapmaması, takip modeli, beğeni sayacının yazma deseni, gerçek
   zamanlılık ya da polling, engellemenin akışa yansıması, moderasyon.
2. I59: ekranlar arası kalite eşitliği, yarım özellik ya da "yakında"
   taraması, geliştirici-günü cinsinden teknik borç, ilk 60 saniyelik
   deneyimin yazılı hali.
3. I60: due diligence dosyası: mimari özet, maliyet eğrisi, güvenlik ve uyum
   özeti, teknik borç listesi, devir kılavuzu.

Kapanır: **I59, I60, J-Sosyal**
Cayan: ekip büyüklüğü, yol haritası ve bütçe hakkında 3 soru.

### ⬜ Faz 28: Final denetim

Kod dondurulur ve tek commit etiketlenir. Promptun §2 künyesi doldurulur.
Denetim, hedefi ve bu planı bilmeyen temiz bir oturumda promptun kendisiyle
çalıştırılır. Çıktılar: Tablo 1–4, sonuç raporu, JSON.
Cayan: künyeyi onayla, promptu yeni oturuma yapıştır.

### ⬜ Faz 29: Düzeltme döngüsü

9.8'in altında kalan her kategori için: bulgu → düzeltme → cihaz kanıtı →
§12'ye göre delta denetim. Hepsi 9.8 ya da üstü olana kadar tekrarlanır.

---

## İşlem envanteri: 84 işlem × 8 kontrol

Hücreler: ⬜ bekliyor · ✅ kanıtlı geçti · 🔴 hata bulundu, düzeltiliyor ·
N/A uygulanamaz (gerekçesi faz raporunda).

### Faz 11: Hesap yaşam döngüsü

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ01 | İlk açılış (oturumsuz soğuk başlatma) → giriş ekranı | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ02 | Kayıt: e-posta, şifre gereksinimleri, kullanıcı adı, ad | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ03 | Kullanıcı adı ve e-posta uygunluk kontrolü | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ04 | Kayıtta profil fotoğrafı (opsiyonel) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ05 | Yasal metinler ve KVKK onayı | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ06 | E-posta doğrulama linki → uygulama (AuthCallback) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ07 | Giriş (autofill, şifre göster/gizle, klavye next/done) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ08 | Hatalı giriş → kilit ve kalan süre mesajı | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ09 | Şifremi unuttum → e-posta → link → yeni şifre | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ10 | Oturum açıkken soğuk başlatma, token yenileme, oturum düşmesi | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ11 | Çıkış: yerel veri, cache ve push token temizliği | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ12 | Hesap silme: tablolar ve storage gerçekten boşalıyor | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ13 | Aynı hesap iki cihazda, cihazda hesap değiştirme | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 12: Profil ve ayarlar

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ14 | Profili düzenle: ad, kullanıcı adı, biyografi | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ15 | Profil fotoğrafı değiştir / kaldır | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ16 | Kapak fotoğrafı değiştir / kaldır | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ17 | Şifre değiştir (Ayarlar → Şifre) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ18 | Hesabı gizli / açık yap | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ19 | Analitik izni aç / kapat | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ20 | Kişisel verileri dışa aktar | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ21 | Engellenenler → profili gör → engeli kaldır | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ22 | Kendi profilim: sekmeler, sayaçlar, sayfalama, yenileme | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ23 | Ayar formlarında iptal/geri/kaydet, kaydedilmemiş değişiklik uyarısı | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 13: Sosyal graf

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ24 | Başka profili açma (akış, keşfet, bildirim, yorumdan) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ25 | Takip et / takibi bırak (açık hesap) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ26 | Gizli hesaba takip isteği gönder / geri çek | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ27 | Takip isteğini kabul et / reddet | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ28 | Takipçiler / takip edilenler, oradan takip | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ29 | Engelle / engeli kaldır: iki yönde görünmezlik (akış, yorum, profil, bildirim) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ30 | Kullanıcıyı şikâyet et | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ31 | Gizli hesabın içeriği takipçi olmayana görünmüyor | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 14: Listeler

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ32 | Liste oluştur: ad, emoji, açıklama, açık/özel, kapak | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ33 | Liste düzenle: tüm alanlar, görünürlük değişimi | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ34 | Liste sil: içindeki kartlar ve medyaya ne oluyor | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ35 | Liste beğen / geri al | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ36 | Listeyi şikâyet et | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ37 | Liste detayı: başlık, kartlar, sayfalama, konum haritası | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ38 | Listeyi paylaş | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ39 | Kapaksız listenin her yüzeyde görünümü | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 15: Mekân kartları

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ40 | Haritadan konum seçip mekân ekle (editörün tüm adımları) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ41 | Arama / geocoding ile mekân bul ve ekle | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ42 | Metinle mekân ekleme | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ43 | Mekân kartını düzenle | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ44 | Mekân kartını sil | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ45 | Mekânı başka listeye ekle / alıntıla | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ46 | Menü linki, yol tarifi, haritada aç | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ47 | Mekân kartını paylaş | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ48 | Mekânı şikâyet et | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ49 | Özellik chip'leri, "+N" aç/kapa, etiketler | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ50 | Aynı konumdaki kartlar ekranı | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 16: Medya

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ51 | Kameradan fotoğraf çek ve ekle | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ52 | Galeriden seç (çoklu seçim, sınırlı erişim) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ53 | Video ekle (süre ve boyut sınırı) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ54 | Medyayı sırala / sil | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ55 | Yükleme ilerlemesi, iptal, arka plana alınca ne oluyor | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ56 | Lightbox: tam ekran, kaydırma, yakınlaştırma, kapatma | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ57 | Özel listedeki medya yalnız yetkiliye görünüyor (imzalı URL) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 17: Yorum ve beğeni

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ58 | Mekân beğen / geri al (sayaç, tek bildirim) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ59 | Yorumları aç: sheet, sayfalama, boş durum | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ60 | Yorum yaz: içerik filtresi, uzunluk sınırı | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ61 | Yoruma yanıt ver | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ62 | Yorumu düzenle | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ63 | Yorumu sil (yanıtlara ne oluyor) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ64 | Yorum beğen / geri al | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ65 | Yorumu şikâyet et | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 18: Akış, keşfet, harita, navigasyon, kesinti

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ66 | Ana akış: ilk yükleme, yenileme, sonsuz kaydırma, liste sonu | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ67 | Keşfet: listeler, mekânlar, kullanıcılar | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ68 | Keşfet araması: debounce, iptal, boş sonuç | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ69 | Harita: konum izni, konumuma git, pin → önizleme, küme → yakınlaştır, lejant | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ70 | Kart içi mini harita: dokununca etkinleşiyor, kaydırmayı çalmıyor | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ71 | Sekme geçişi: kaydırma konumu ve durum korunuyor, yeniden yükleme yok | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ72 | Geri: Android donanım tuşu, çift basınca çıkış | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ73 | Arka plana alıp geri gelme, ekran kilidi, gelen arama | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ74 | Çevrimdışı: gösterge, outbox kuyruğu, bağlantı gelince senkron | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ75 | OTA güncellemesinin sessizce alınıp sonraki açılışta uygulanması | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Faz 19: Bildirim, push, deep link

| # | İşlem | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | iOS |
|---|---|---|---|---|---|---|---|---|---|---|
| İ76 | Bildirim izni: önce açıklama, reddetme, ayarlara yönlendirme | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ77 | Bildirim listesi, 6 kategori filtresi, sayfalama | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ78 | Bildirime dokun → doğru hedef + okundu | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ79 | Tümünü okundu yap, rozet sayacı | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ80 | 10 bildirim tipinin her biri: metin, tekillik, hedef | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ81 | Push: uygulama açık / arka planda / kapalı → dokun → doğru ekran | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ82 | Bildirimler sistemden kapatılınca davranış | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ83 | Paylaşılan link (liste, mekân, profil) → uygulama; yetkisiz içerik açılmıyor | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| İ84 | Oturum kapalıyken korumalı link → giriş → hedefe dönüş | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

İ80'deki 10 tip: comment, comment_like, comment_reply, follow, follow_request,
like, list_liked, place_added, place_quote, system_announcement.

---

## 61 puanlama birimi: hangi fazda kapanır

| Birim | Ağr. | Kapanış fazı | Katkı veren fazlar | Cayan'a bağlı mı |
|---|---|---|---|---|
| A1 İlk açılış & onboarding | ×3 | 11 | 9A, 22 | — |
| A2 Bilgi mimarisi & navigasyon | ×3 | 18 | 5, 9B | — |
| A3 Geri / çıkış / kesinti | ×2 | 26 | 10, 18 | iPhone |
| A4 Ekran durum matrisi | ×3 | 9A | 5 | — |
| A5 Form & klavye | ×2 | 17 | 5, 11–16 | — |
| A6 Mikrokopi | ×2 | 19 | 9B, 11–18 | — |
| A7 İzin akışları | ×2 | 26 | 10 | iPhone |
| A8 Hesap yaşam döngüsü | ×3 | 11 | 12 | e-posta linki |
| B9 Tasarım sistemi & token | ×3 | 6 | 3, 5 | Maps ekran görüntüsü |
| B10 Tipografi | ×2 | 3 | — | — |
| B11 Renk & kontrast | ×2 | 9B | 3 | — |
| B12 Boşluk & hizalama | ×2 | 9B | 3, 5 | — |
| B13 İkonografi & varlıklar | ×1 | 4 | 3 | ikon onayı |
| B14 Motion | ×2 | 9A | — | — |
| B15 Haptik | ×1 | 9A | 5 | — |
| B16 AAA cila | ×2 | 9A | 5, 6 | — |
| C17 Responsive | ×3 | 26 | 10 | iPhone |
| C18 Platform uyumu | ×2 | 26 | 10, 25 | iPhone |
| C19 Erişilebilirlik | ×2 | 26 | 10 | iPhone |
| C20 Dinamik yazı tipi | ×1 | 26 | 10 | iPhone |
| D21 Başlangıç performansı | ×3 | 22 | — | iPhone (10 açılış) |
| D22 Render & liste | ×3 | 22 | 7 | — |
| D23 Bellek | ×2 | 22 | — | — |
| D24 Ağ performansı | ×2 | 22 | 21 | — |
| D25 Pil | ×1 | 22 | — | — |
| E26 Mimari | ×3 | 7 | — | — |
| E27 God class | ×2 | 7 | — | — |
| E28 DRY | ×2 | 7 | 5, 6 | — |
| E29 KISS | ×2 | 7 | — | — |
| E30 Hardcode | ×3 | 8 | 3 | — |
| E31 İsimlendirme | ×2 | 8 | — | — |
| E32 Ölü kod | ×1 | 7 | — | — |
| E33 Test | ×2 | 24 | 8, 11–19 | — |
| E34 Genişleyebilirlik | ×1 | 8 | — | — |
| F35 Durum yönetimi | ×3 | 21 | — | — |
| F36 Ağ katmanı | ×3 | 21 | — | — |
| F37 Çevrimdışı | ×2 | 21 | 18 | — |
| F38 Senkron & idempotency | ×2 | 21 | 11–19 | — |
| F39 Medya pipeline | ×2 | 16 | — | — |
| F40 Zaman | ×1 | 21 | — | — |
| G41 Kimlik doğrulama | ×3 | 20 | 11 | — |
| G42 Sır saklama | ×3 | 20 | — | — |
| G43 Taşıma & API | ×3 | 20 | 11–19 (T5) | SSL pinning kararı |
| G44 İstemci sertleştirme | ×1 | 20 | — | — |
| G45 Gizlilik & KVKK | ×3 | 25 | 12 | konsol + hukuk |
| G46 Kötüye kullanım | ×2 | 20 | 13 | moderasyon sorumlusu |
| H47 Backend ölçek | ×2 | 23 | — | Supabase paneli |
| H48 Hata yönetimi | ×3 | 23 | — | Sentry |
| H49 Gözlemlenebilirlik | ×2 | 23 | — | Sentry |
| H50 Analitik | ×1 | 23 | — | PostHog |
| H51 CI/CD | ×2 | 24 | — | branch koruması |
| H52 Sürüm & geri alma | ×2 | 24 | 4 | zorunlu güncelleme kararı |
| H53 Bağımlılık & lisans | ×1 | 24 | — | — |
| H54 Belgeleme | ×1 | 24 | — | — |
| I55 App Store | ×3 | 25 | 4 | App Store Connect |
| I56 Play Store | ×3 | 25 | 4 | Play Console |
| I57 Push & deep link | ×2 | 26 | 19 | iPhone |
| I58 Yasal | ×2 | 25 | — | hukuk onayı |
| I59 Genel olgunluk | ×3 | 27 | hepsi | — |
| I60 Due diligence | ×1 | 27 | — | 3 soru |
| J-Sosyal | ×2 | 27 | 13, 18 | — |

Özet: **37 birimi** tamamen ben kapatırım. **24 birimde** senden bir şey
gerekiyor:

- 8'i küçük iş (1–15 dk): A8, B9, B13, G43, G46, H51, H52, I60. Bir onay,
  karar ya da ekran görüntüsü yeter.
- 4'ü panel erişimi: H47, H48, H49, H50.
- 4'ü konsol ve hukuk: G45, I55, I56, I58.
- 8'i iPhone: A3, A7, C17, C18, C19, C20, I57 ve D21 (D21 yalnızca 10 açılış).

Bunlar gelmezse ilgili birimler K2 gereği ⬜ kalır; uydurma puan yazılmaz.

---

## Dürüst riskler

1. **Puanı ben vermem.** Kendi işime not vermek hedefi anlamsızlaştırır.
   Final denetim temiz oturumda yapılır. 9.8 bir hedeftir, garanti değildir;
   altında kalan her şey için Faz 29 var.
2. **Kodla çözülemeyen rubrik maddeleri.** I60 "tek kişiye bağımlılık" ve
   H51 "code review zorunluluğu" tek kişilik ekipte tam kapanmaz. Belge,
   branch koruması ve zorunlu CI kontrolleriyle azaltılır. Denetçi yine de
   puan kırabilir.
3. **D21 cold start < 2 sn**, 2020 model orta segment Android'de zor olabilir.
   Faz 22'de ölçülür; tutmazsa dürüst puan yazılır.
4. **Her native değişiklik yeni bir binary demek.** Planda iki native paket
   var (Faz 4 ve Faz 25). Her birinde yüklemeyi sen yaparsın.
5. **Yayınlanan, teslim edilen değildir.** Her fazın düzeltmesi
   `ota:verify-device` ile cihazda kanıtlanmadan tik atılmaz.
