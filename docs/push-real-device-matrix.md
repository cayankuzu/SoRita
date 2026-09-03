# Push gerçek cihaz matrisi

Bu matris canlı test sonucu değildir. “Kaynak testi” satırları yalnız yerel
pre-commit testlerini, “Bekliyor” satırları ise gerçek cihaz/sağlayıcı kanıtı
gerektiren işleri gösterir. Hedefli push/config testleri 34/34 ve push dahil
izole DB seti 6 dosya/180 pgTAP olarak geçmiştir; bunlar cihaz satırlarını
tamamlamaz.

Hedef candidate metadata'sı kaynakta app `1.0.102`, Android 107 ve iOS 87'dir;
henüz immutable candidate SHA veya iki-platform signed build kimliği yoktur.

| Ortam / senaryo | Beklenen sonuç | Durum | Kanıt alanı |
| --- | --- | --- | --- |
| Birim: data-only FCM handler | Tek genel yerel bildirim; payload saklanmaz; duplicate bastırılır | Kaynak testi | `systemPushBackgroundHandler.test.ts` |
| Birim: Expo token tombstone | Ağ hatasında tombstone kalır; doğru sırla idempotent revoke | Kaynak testi | `pushTokenCleanup.test.ts` |
| Birim: hesap değişimi | Bekleyen eski token tombstone'u varken B hesabı bağlanmaz | Kaynak testi | `PushNotificationsController.test.tsx` |
| Birim: tap rota | Geçersiz payload düşer, recipient-owned satır rota belirler, retry iptal edilir | Kaynak testi | `pushNavigation.test.ts` |
| Android fiziksel cihaz, Expo normal push | İzin, foreground, background, killed tap | Bekliyor | cihaz modeli / Android sürümü / build / UTC zaman / sonucu |
| Android fiziksel cihaz, FCM notification payload | OS bildirimi tek kez; tap Notifications açar | Bekliyor | Firebase message id hash / ekran kaydı referansı |
| Android fiziksel cihaz, FCM data-only killed | Genel yerel bildirim tek kez; tap Notifications açar | Bekliyor | aynı veri alanları |
| iOS fiziksel cihaz, Expo normal push | İzin türleri, foreground/background/killed teslim ve tap | Bekliyor | model / iOS / APNs ortamı / UTC zaman / sonucu |
| iOS fiziksel cihaz, FCM sistem akışı | Sağlayıcı yapılandırmasına göre teslim | Bekliyor | FCM/APNs yapılandırma sahipliği ve kanıtı |
| Logout çevrimdışı → yeniden ağ | Tombstone anonim temizlenir, eski hesabın tokenı kalmaz | Bekliyor | test hesabı ID takma adı / UTC zaman / health sonucu |
| Hesap A → B, ağ kesintili | B kaydı tombstone çözülene dek bekler | Bekliyor | A/B takma adları / UTC zaman / sonucu |
| Expo Go | Uzaktan kayıt atlanır; uygulama çökmez | Bekliyor | Expo SDK/build/sonuç |
| Permission startup/background | Startup/background prompt açmaz; kullanıcı-initiated akış açabilir | Bekliyor | build / OS / temiz kurulum / ekran kaydı referansı |
| Schedule hatası → retry | Başarısız local schedule marker yazmaz; sonraki deneme tek bildirim üretir | Bekliyor | kontrollü hata enjeksiyonu / UTC / gözlem |
| Out-of-order/duplicate burst | Eşzamanlı aynı `messageId` yalnız tek görünüm üretir | Bekliyor | message-id hash / lifecycle / sonuç |

Gerçek test kaydı aşağıdaki bilgileri içermelidir; token, sırrı, ham kullanıcı içeriği veya tam IP içermemelidir:

```text
Build: <versionCode/versionName veya iOS build>
Device: <model + OS>
Scenario: <matris satırı>
UTC timestamp: <ISO-8601>
Expected / observed: <kısa sonuç>
Evidence reference: <CI artifact, güvenli ekran kaydı veya test kaydı>
```

Bu belgeye “geçti” yazılması için yalnız uygulama içi görünüm değil, hedef ortamda token lifecycle ve scheduler health kontrolü de gerekir.

Release kararı: iki fiziksel platformdaki bütün uygulanabilir satırlar aynı
candidate SHA/build'e bağlanana kadar `NO-GO`.
