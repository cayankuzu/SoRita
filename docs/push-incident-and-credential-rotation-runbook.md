# Push olay ve credential rotation runbook

Bu runbook komut ve karar çerçevesidir; burada gerçek bir olayın yaşandığı,
credential rotate edildiği, scheduler alarmının tetiklendiği veya provider
receipt'lerinin sağlıklı olduğu iddia edilmez. Yerel DB/test sonucu provider
operasyon kanıtı değildir.

## İlk 15 dakika

1. Olay kimliği açın; token, cleanup sırrı, admin token, service-role key, ham payload, IP ve kullanıcı içeriğini kayda yazmayın.
2. `npm run ops:push-delivery:health` ile scheduler modu, health, bekleyen iş ve DLQ sayısını kontrol edin.
3. Gönderim patlaması/yanlış hedef şüphesinde uygulama push feature flag'ını güvenli yapılandırma sürecinizle kapatın. Yeni product yüzeyi veya koddan hızlı bypass eklemeyin.
4. Admin broadcast şüphesinde `SYSTEM_BROADCAST_ADMIN_TOKEN` ile ilişkili erişimi kesip Edge Function secret'ını rotate edin; sağlayıcı/DB anahtarlarını istemci build'ına koymayın.
5. DLQ requeue yalnız tekil, incelenmiş kayıt için uygulanır. Kör toplu requeue yapmayın.

## Credential rotation

| Credential | Rotate işlemi | Sonraki kontrol |
| --- | --- | --- |
| `SYSTEM_BROADCAST_ADMIN_TOKEN` | Supabase Edge Function secret'ını yeni rastgele değerle değiştirin; eski otomasyonları yeni secret'a geçirin | Yeni token ile sınırlı dry-run, eski token ile 401/abuse limit |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase proje yönetimi üzerinden rotate edin; scheduler ve ops ortam secret'larını atomik güncelleyin | Health RPC yalnız yeni key ile çalışır; eski key geçersizdir |
| FCM server credential | Firebase/Google Cloud prosedürüyle rotate edin; konu yayıncısını güncelleyin | Android gerçek cihazda notification/data-only matris satırları |
| Expo/APNs credential | EAS/Expo ve Apple geliştirici hesabı prosedürüyle rotate edin | iOS gerçek cihaz teslimi ve receipt izlemesi |

İstemci Expo tokenları ve cleanup capability'leri credential değildir. Bunları topluca loglama, export etme veya destek kaydına ekleme yasaktır.

## DLQ ve scheduler işlemleri

```powershell
npm run ops:push-delivery:health
npm run ops:push-delivery:requeue -- requeue --dead-letter-id <uuid> --requeue-key <kalici-uuid> --confirm REQUEUE_PUSH_DELIVERY_DLQ
```

Requeue sonucu `false` ise job tekrar gönderilmemiştir; aktif token, terminal durum veya aynı idempotency anahtarı kontrol edilmelidir. `healthy=false` veya `schedulerMode=external_required` ise harici scheduler çağrısı kanıtlanana kadar teslim sağlıklı kabul edilmez.

## İletişim ve kapanış

- Etkiyi kullanıcı takma adları/sayılarıyla ifade edin; bildirim gövdesi veya token paylaşmayın.
- Hangi credential'ın ne zaman rotate edildiğini, eski credential'ın iptal edildiğini ve gerçek cihaz sonuçlarını güvenli olay kaydına ekleyin.
- Kalıcı düzeltme sonrası source testleri, migration/pgTAP ve gerçek cihaz matrisi tamamlanmadan olayı “tam kapalı” ilan etmeyin.
- Kapanış kaydı exact candidate SHA, build identity, provider ortamı, UTC zaman,
  ticket/receipt ve alert referansını içermelidir; token, secret veya payload
  içeriğini içeremez.

## Mevcut kanıt durumu

Güncel kaynak setinde hedefli push/config testleri 34/34; izole Supabase setinde
6 dosya/180 pgTAP, boş lint ve 22 public tablo restore doğrulaması geçmiştir.
Credential rotation, yanlış yayın durdurma, external scheduler failover, provider
ticket/receipt reconciliation ve alarm teslimi henüz tatbik edilmemiştir;
operasyonel push readiness `NO-GO`dur.
