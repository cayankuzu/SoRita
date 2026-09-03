# Push outbox, retry, receipt ve DLQ

Durum: sözleşme kaynakta ve ileri yönlü migration'da tanımlıdır. Migration izole
yerel Supabase zero-reset/pgTAP/dump-restore doğrulamasından geçmiştir. Hosted
veritabanında `pg_cron`/harici scheduler ve sağlayıcı receipt akışının çalıştığı
doğrulanmamıştır.

Mevcut teslim işçisinin `private.push_delivery_jobs` kuyruğu gönderim ve receipt denemelerini tutar. Sağlayıcı çağrısı en az bir kez (at-least-once) davranışlıdır; sağlayıcı kabulü ile istemci görünümü arasında ağ kesintisi varsa yinelenen teslim mümkün olabilir. İstemci tarafındaki bildirim ID dedupe'i kullanıcı deneyimini azaltır, sağlayıcı teslimini exactly-once yapmaz.

Yeni ileri migration aşağıdaki operasyonel sözleşmeyi ekler:

- `failed` ve `unregistered` terminal job geçişi, `private.push_delivery_dead_letters` içine ayrı audit satırı üretir.
- DLQ ham `payload`, sağlayıcı yanıt gövdesi veya ham hata mesajı taşımaz; yalnız job/notification/alıcı kimlikleri, terminal durum, normalize hata kodu ve sayımlar bulunur.
- Uygulama rolleri DLQ/audit tablolarını doğrudan silip değiştiremez. Süresi dolan DLQ satırlarını yalnız iç retention fonksiyonu kaldırır.
- DLQ retention süresi 90 gündür; worker çalışmasında bounded pruning yapılır.
- Requeue yalnız `public.requeue_push_delivery_dead_letter(dead_letter_id, requeue_key)` üzerinden service role ile yapılır. Aynı anahtar idempotenttir; yalnız başarısız ve hâlâ aktif, aynı alıcıya ait tokenı olan iş requeue edilir.
- `private.push_delivery_worker_health`, worker başlangıç/başarı/hata zamanlarını saklar. `public.get_push_delivery_scheduler_health()` yalnız service role için sağlık, bekleyen iş ve canlı DLQ sayısını döndürür.
- Eski dört parametreli broadcast RPC overload'ı korunur; explicit
  audience/dry-run/idempotency kullanan yeni overload'a geçiş expand/migrate/
  contract sırasındadır.

`pg_cron` varsa worker bir dakikalık schedule ile sağlık wrapper'ını çağırır. `pg_cron` yoksa migration uyarı üretir; yetkili harici scheduler'ın aynı sıklıkta `public.run_push_delivery_worker_for_scheduler()` çağırması ve health RPC'nin izlenmesi zorunludur. Harici scheduler yapılandırması depoda kanıtlanmış değildir.

## Operatör komutları

```powershell
npm run ops:push-delivery:health
npm run ops:push-delivery:requeue -- requeue --dead-letter-id <uuid> --requeue-key <kalici-uuid> --confirm REQUEUE_PUSH_DELIVERY_DLQ
```

Komutlar `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` ister; URL çıplak HTTPS origin olmalıdır. Requeue için eldeki DLQ kimliği ve ayrı, saklanan requeue anahtarı gerekir. Komut başarısızsa veya sağlık `healthy=false` dönerse otomatik başarı varsayılmaz.

SQL sözleşmesi için `supabase/tests/push_delivery_hardening.sql` pgTAP kaynağı
eklenmiştir. Güncel tüm migration'larla izole yerel doğrulamada DB lint
`results: []`, 6 dosya/180 pgTAP testi ve ayrı veritabanına 22 public tablo
dump/restore kontrolü geçmiştir. Bu sonuç hosted scheduler/receipt alarmı veya
same-SHA release evidence değildir; production teslim kapısı `NO-GO`dur.
