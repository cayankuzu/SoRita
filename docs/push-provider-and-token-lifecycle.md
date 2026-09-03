# Push sağlayıcı ve token yaşam döngüsü

Durum: istemci ve ileri yönlü migration kaynağı hazırlanmış; migration izole
yerel Supabase zero-reset/pgTAP doğrulamasından geçmiştir. Hosted staging veya
production'a uygulandığı ve sağlayıcı kimlik bilgilerinin çalıştığı iddia
edilmez.

## Sağlayıcılar

- Kullanıcıya ait uygulama bildirimleri Expo push token ile kuyruklanır.
- Sistem bildirimi istemcisi, yapılandırılmış FCM konu aboneliğini kullanır.
- Depoda FCM konuya yayın yapan bir sunucu göndericisi bulunmadığından, FCM gönderici kimliği/credential doğrulaması `UNVERIFIED` durumundadır. Bu durum canlıya çıkış onayı değildir.

FCM sistem konusu eksikse istemci kaydı atlar. Expo Go ve fiziksel cihaz olmayan çalışma zamanlarında uzaktan kayıt atlanır; bu beklenen davranıştır.

## Expo token bağlama ve temizleme

1. Kayıt sırasında istemci 256 bitlik temizleme sırrı üretir ve yalnız güvenli cihaz deposuna yazar.
2. `upsert_user_push_token(token, platform, cleanup_secret)` yalnız sırrın SHA-256 özetini saklar.
3. Çıkıştan önce istemci token+sırrı dayanıklı tombstone olarak güvenli depoya yazar. Bu yazı başarısız olursa logout fail-closed kalır; yerel oturum silinmez.
4. Normal çıkış kaldırma RPC'si başarısız olsa bile tombstone kalır. Oturumdan bağımsız, dar yetkili `revoke_push_token_with_cleanup_secret` RPC'si sonraki ağ/aktif pencere sırasında tekrar denenir.
5. Anonim revoke yalnız doğru token ve doğru sır özeti ile siler. Token zaten silinmişse başarılı sayılır; başka sırla hâlâ mevcutsa tombstone tutulur.
6. Hesap değişiminde önce eski token tombstone'a alınır ve flush edilir. Bekleyen tombstone varken yeni hesabın aynı fiziksel tokenı bağlaması ertelenir.

SecureStore tombstone okuma-değiştirme-yazma işlemleri modül-içi async kuyrukla
seri yürütülür. Retry controller en fazla sekiz deneme ve 30 dakikalık pencere
içinde, yaklaşık ±%20 jitter ile çalışır; AppState/token olayı bounded pencereyi
yeniden başlatabilir. Sonsuz beş dakikalık timer bırakılmaz.

Tombstone ve aktif capability ham token ile sır içerdiğinden yalnız `expo-secure-store` üzerinden tutulur; AsyncStorage'a fallback yapılmaz. Uygulama logları token, sır veya sağlayıcı payload'ı içermez.

## Operasyonel sınırlar

- Token temizleme sırrı kullanıcı parolası değildir; yine de gizli sayılır ve destek kaydı, telemetry veya hata çıktısına yazılmaz.
- Token yeniden atanması sunucuda fiziksel tokenın önceki hesabını silerek atomiktir; eski capability mevcutsa istemci tarafı temizleme bunu daha da sıkılaştırır.
- Eski uygulama sürümünde capability yoksa yeni sürüm ilk yetkili kayıtta capability bağlar. Ağ kesintili yükseltme akışı gerçek cihazda ayrıca test edilmelidir.
- Migration, eski binary'ler için iki parametreli `upsert_user_push_token`
  overload'ını korur; cleanup-secret kullanan yeni overload expand aşamasıdır.
  Eski imza ancak adoption kanıtı ve ayrı contract migration'ıyla kaldırılabilir.

Kaynaklar: `pushTokenCleanup.ts`, `pushNotificationRepository.ts`, `20260831120000_harden_push_delivery_operations.sql`.

Yerel kanıt: hedefli push/config testleri 34/34; güncel migration setiyle 6
dosya/180 pgTAP. Sonuç pre-commit ve yereldir; provider token rotation, reinstall,
logout-offline ve hesap A→B fiziksel cihaz kanıtı yoktur.
