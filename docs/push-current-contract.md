# Push: mevcut sözleşme

Durum: kaynak kodunda uygulanmış ve hedefli yerel testlerde doğrulanmıştır;
gerçek cihaz, push provider ve hosted Supabase ortamı kanıtı bu belgeye henüz
eklenmemiştir. Yerel sonuçlar pre-commit çalışma ağacına aittir.

Bu çalışma yeni bildirim türü, ekranı veya CTA eklemez. Uygulamanın kabul ettiği bildirim türleri mevcut küme ile sınırlıdır:

`like`, `follow`, `follow_request`, `comment`, `place_added`, `place_quote`, `list_liked`, `comment_like`, `comment_reply`, `system_announcement`.

Normal uygulama bildirimleri Expo token kaydıyla gönderilir. Tap verisindeki `notificationId`, `type`, `userId`, `listId` ve `placeId` yalnızca biçim denetiminden geçer; ayrıntılı rota doğrudan bu veriden kurulmaz. Oturumdaki alıcı için `notifications` tablosundan alınan, RLS ile sahipliği doğrulanmış satır rota kaynağıdır. Uyuşmazlık, kayıt yokluğu veya doğrulama hatası mevcut `Notifications` ekranına düşer.

| Akış | Kaynak davranış | Güvenlik sınırı |
| --- | --- | --- |
| Uygulama açıkken Expo bildirimi | Mevcut foreground görünümü ve cache yenilemesi | Tip/rota sözleşmesi değişmez |
| Expo tap | Doğrulanmış bildirim satırından `ListDetail`, `UserProfile` veya `Notifications` | Sağlayıcı payload'ı rota otoritesi değildir |
| FCM sistem bildirimi açıkken | Mevcut sistem bildirim görünümü | Yalnız mevcut `Notifications` ekranı açılır |
| FCM data-only arka plan/sonlandırılmış | Genel yerel “SoRita / Yeni sistem bildirimi” | Uzak başlık, gövde, token ve payload saklanmaz/kopyalanmaz |
| OS bildirimi | OS gösterimi korunur | Background handler aynı bildirimi ikinci kez göstermez |

Arka plan FCM handler’ı JS giriş noktasında React ağacından önce bir kez kaydedilir. Sadece `messageId` olan data-only mesajları işler; 32 adet, yalnızca 8 karakterlik opak tekrar önleme işaretini yerel depoda tutar. Bu işaret kriptografik kimlik veya iletim kanıtı değildir.

Marker okuma/yazma işlemleri modül içi kuyrukla seri yürür. Yerel bildirim
başarıyla schedule edilmeden marker kalıcılaştırılmaz; schedule hatası sonraki
meşru denemeyi kalıcı olarak bastırmaz. Startup ve background registration
`requestPermissionsAsync` çağırmaz; sistem izin prompt'u yalnız mevcut
kullanıcı-initiated izin akışından açılabilir.

Yönlendirme hazır değilse deneme 350 ms aralıkla en fazla sekiz kez yapılır. Kullanıcı değiştiğinde veya controller unmount olduğunda bekleyen deneme iptal edilir. Böylece eski oturumun tap’i yeni oturumda rota açamaz.

Doğrulama kaynakları:

- `src/mobile/app/app-shell/notifications/pushNavigation.ts`
- `src/mobile/app/app-shell/notifications/PushNotificationsController.tsx`
- `src/mobile/app/app-shell/notifications/SystemPushNotificationsController.tsx`
- `src/mobile/app/platform/notifications/systemPushBackgroundHandler.ts`

Gerçek cihazda OS izinleri, FCM/APNs teslimi ve tap davranışı ayrıca `push-real-device-matrix.md` ile kayda alınmalıdır.

## Yerel kanıt ve sınırı

- Push/config hedefli testler: 34/34 geçti.
- Güncel migration setiyle izole Supabase doğrulaması: 6 dosya/180 pgTAP testi
  geçti; DB lint boş sonuç verdi; ayrı restore veritabanında 22 public tablo
  doğrulandı.
- Feature-surface guard: 12/12 geçti; bildirim türü 10 ve kategori 6 kaldı.

Bu kanıtlar immutable candidate SHA'ya veya hosted provider'a bağlı değildir.
FCM/APNs/Expo ticket/receipt, foreground/background/terminated ve token rotation
matrisi iki fiziksel platformda tamamlanmadan push release kapısı `NO-GO`dur.
