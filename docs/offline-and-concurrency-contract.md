# SoRita çevrimdışı ve eşzamanlılık sözleşmesi

Tarih: 2026-08-30
Durum: Kaynak ve birim sözleşmeleri mevcut; fiziksel cihaz ve canlı backend yarışları `UNVERIFIED`; yayın `NO-GO`.

## Temel ilkeler

1. Supabase/Postgres/Storage sunucu durumu nihai kaynaktır; cihaz cache'i veya outbox tek başına başarı kanıtı değildir.
2. Çevrimdışı okuma sınırlı ve süreli bir son-bilinen görünüm sağlar; tüm ekranların tam offline çalışacağı vaat edilmez.
3. Yalnız açıkça izin verilen sekiz yazma türü dayanıklı kuyruğa girebilir.
4. Abort edilen veya istemci hatası olduğu bilinen istekler körlemesine yeniden oynatılmaz.
5. Tüm kalıcı kullanıcı verisi kullanıcı kimliğiyle kapsamlanır ve auth sınırında temizlenir.
6. Retry, idempotency yerine geçmez; tekrar oynatılabilen her mutasyon kararlı kimlik veya istenen-son-durum taşır.

## Bağlantı durumu

[connectivityStatus.ts](../src/mobile/app/platform/network/connectivityStatus.ts) dört durum tanımlar: `unknown`, `online`, `offline`, `constrained`. HTTP probe süresi 3 saniyeyi aşarsa `constrained`; abort edilen probe da `constrained`, diğer probe hataları `offline` kabul edilir. [useNetworkStatus.ts](../src/mobile/app/platform/network/useNetworkStatus.ts), NetInfo ve uygulama yaşam döngüsünü TanStack Query `onlineManager` ile bağlar.

`constrained`, kesin offline değildir. Okumalar yapılabilir; gecikme ve timeout olasılığı yüksektir. Cihaz üreticisi/ağ geçişi davranışı kaynak koddan kanıtlanamaz: `UNVERIFIED`.

## Okuma ve cache sözleşmesi

React Query genel varsayılanları:

| Ayar | Sözleşme |
| --- | --- |
| `staleTime` | 5 dakika |
| `gcTime` | 2 saat |
| Mount/window | Mount'ta ve window focus'ta otomatik refetch yok; reconnect'te refetch var |
| Normal query retry | En çok 1 retry |
| HTTP `429` veya `5xx` | En çok 2 retry |
| Retry edilmeyen durumlar | `400`, `401`, `403`, `404`, `409`, `422` |
| Gecikme | `min(500 × 2^attemptIndex, 2000)` tavanının %50–%100 jitter'ı |
| `Retry-After` | Saniye veya HTTP tarihi; en çok 30 saniye |
| Mutation retry | Varsayılan olarak kapalı |

Kaynak: [queryClient.ts](../src/mobile/app/data/query/queryClient.ts).

Kalıcı startup query cache yalnız kullanıcı kapsamlı ilk ekran modellerine izin verir:

- Feed sayfası.
- Boş aramalı Explore liste sayfası.
- Oturum sahibinin profil özeti ve liste içeriği.
- Bildirim listesi ve okunmamış sayısı.
- Harita marker'ları.

Sınırlar: en fazla 7 query, toplam 1 MB, infinite query'nin yalnız ilk sayfası ve 650 ms persist debounce. Retention bildirim için 2 saat, keşif için 6 saat, feed için 12 saat, harita/profil için 24 saattir. Yerel URI'ler ve token/imza/expiry içeren kısa ömürlü medya URL'leri diske yazılmaz. Restore/persist işleri kullanıcı nesliyle izlenir; purge nesli artırır, planlanmış işleri iptal eder ve çalışan işleri drain eder.

Görünür veri snapshot'ı 12 saat geçerlidir ve en çok 24 liste × 32 mekân × 8 yorum × 4 yanıt tutar. Entity ve screen index cache'lerinin varsayılan TTL'i 24 saattir. Bu cache'ler stale veri gösterebilir; bağlantı gelince sunucu refetch'i uzlaştırır.

## Dayanıklı outbox kapsamı

[outboxStorage.ts](../src/mobile/app/data/outbox/outboxStorage.ts) yalnız aşağıdaki türleri kabul eder:

| Tür | Mevcut kullanıcı eylemi | Replay yaklaşımı |
| --- | --- | --- |
| `comment-create` | Yorum/yanıt oluşturma | Önceden üretilmiş `commentId` ile idempotent create |
| `lists-update` | Kullanıcının listelerini güncelleme | Liste ID kümesine bağlı dedupe; payload'daki istenen durum |
| `media-cleanup` | Başarısız/terk edilmiş medya varlıklarını silme | Kova + URL kümesi, bağımlılık desteği |
| `moderation-report` | Kullanıcı/liste/mekân/yorum raporlama | Reporter/hedef/neden tabanlı idempotency key |
| `notification-read` | Bildirimi okundu işaretleme | Bildirim ID'sine göre istenen durum |
| `place-like-state` | Mekân beğenme/beğeniyi kaldırma | `liked` istenen-son-durum |
| `user-follow-state` | Takip/istek/takipten çıkma | `following/requested/unfollowed` istenen-son-durum |
| `user-block-state` | Engelleme/engeli kaldırma | Kullanıcı çifti + istenen durum |

Yeni outbox türü yeni ürün yüzeyi sayılabilir ve [existing-feature-contract.md](existing-feature-contract.md) sürecinden geçmeden eklenemez.

## Kuyruğa alma kararı

[shouldQueueOfflineOperation.ts](../src/mobile/app/data/outbox/shouldQueueOfflineOperation.ts) aşağıdaki durumlardan birinde işlemi kuyruklanabilir sayar:

- TanStack `onlineManager` kesin offline.
- Yerel bağlantı durumu `offline`.
- Ağ katmanı `TypeError` üretti.
- HTTP durumu `408`, `429` veya `>=500`.

Abort hatası hiçbir koşulda kuyruklanmaz. `400/401/403/404/409/422` gibi kalıcı/kimlik/yetki/çakışma hataları genel kuralla outbox'a taşınmaz. Her repository/hook yalnız kendi desteklenen eylemi için enqueue çağırabilir; bu yardımcı tüm mutasyonları otomatik olarak kalıcı yapmaz.

## Saklama, sıralama ve replay

- Storage anahtarı sürüm + kullanıcı kimliği içerir.
- Aynı kullanıcının outbox okuma-yazma işlemleri promise tabanlı kilitle seri hale getirilir.
- Aynı `idempotencyKey` yeniden enqueue edilirse eski giriş çıkarılıp yenisi yazılır; amaç aynı eylemin kuyruk kopyalarını çoğaltmamaktır.
- Girişler önce `nextAttemptAt`, sonra oluşturulma zamanına göre sıralanır.
- Bağımlı giriş ancak bağımlılığı yoksa veya `done` durumundaysa due olur.
- Aynı kullanıcı için eşzamanlı replay çağrıları tek in-flight promise'i paylaşır.
- Başarılı replay girişi siler. Hata; deneme sayısını artırır, en fazla 300 karakter hata kaydı tutar ve girişi `failed` olarak ileri tarihe taşır.
- Backoff `min(1 saat, 1000 × 2^min(attempt,12))` formülüdür. Toplam deneme sayısı için sabit bir üst sınır yoktur; kalıcı hata kullanıcı/operasyon müdahalesi gerektirebilir.
- Başarılı bir girişin kaldırılmasından sonra kuyruk yeniden okunur; böylece yeni açılan bağımlılıklar aynı bağlantı penceresinde yürüyebilir.
- Sync, bağlantı online olduğunda, uygulama active olduğunda ve planlanan `nextAttemptAt` geldiğinde tetiklenir. Kaynak: [OutboxSyncController.tsx](../src/mobile/app/app-shell/providers/OutboxSyncController.tsx) ve [outboxRuntime.ts](../src/mobile/app/data/outbox/outboxRuntime.ts).

## Optimistic UI ve çakışma sözleşmesi

Mevcut hook'lar desteklenen eylemlerde ilgili query'leri iptal eder, önceki cache snapshot'ını alır, optimistic istenen durumu yazar, hata halinde rollback eder ve settlement sonrası sunucuyu invalidate/refetch eder. Bu, istemci tarafında hızlı geri bildirim sağlar; sunucu yetki/RLS/bütünlük kararını geçersiz kılmaz.

İstenen-son-durum taşıyan like/follow/block işlemleri, sırf toggle tekrarlandığı için ters sonuca düşmeyi azaltır. Yorum create kararlı UUID kullanır. Liste/media gibi çok adımlı işlemler outbox dependency ve server-side idempotency/atomiklik sözleşmesine dayanır.

Aşağıdakiler garanti edilmez:

- Farklı cihazlardaki eşzamanlı düzenlemelerde genel CRDT/alan bazlı merge.
- Sınırsız offline veri veya tüm mutasyonların offline desteği.
- Sunucuya hiç ulaşmamış bir kuyruk girişinin kullanıcıya kalıcı başarı olarak gösterilmesi.
- Süresiz saklama; auth sınırı temizliği kullanıcı gizliliği lehine outbox'ı siler.

## Oturum ve kullanıcı sınırı

[sessionRefresh.ts](../src/mobile/app/platform/supabase/sessionRefresh.ts) süreç içindeki tüm refresh çağrılarını tek in-flight Supabase yenilemesine birleştirir; single-use refresh token yarışını engeller.

[privateSignedReadUrls.ts](../src/mobile/app/platform/supabase/privateSignedReadUrls.ts) özel medya erişimini `userId + session generation + bucket/path` ile kapsamlar. Aynı anahtar in-flight isteği paylaşır, en çok 64 yolu batch'ler, URL'yi en çok 4 dakika cache'ler ve süresinin bitmesine 30 saniyeden az kalan kaydı yeniden kullanmaz. Purge; nesli artırır, cache/in-flight/pending durumunu temizler, aktif batch'leri abort eder ve eski kapsam sonucunu reddeder.

[authUserStatePurge.ts](../src/mobile/app/app-shell/auth/session/authUserStatePurge.ts), logout ve kullanıcı değişiminde şu alanları bağımsız olarak temizlemeye çalışır:

- Özel medya imzalı URL ve çalışan istekleri.
- React Query istek/cache durumu.
- Tüm Supabase Realtime kanalları.
- Kullanıcıya ait startup/screen, görünür snapshot, entity cache ve outbox.

Aynı kullanıcı için eşzamanlı purge çağrıları tek promise'i paylaşır. Bir alt temizlik hata verirse diğerleri `Promise.allSettled` ile yine çalışır; başarısız operasyon adları sanitize loglanır ve toplu hata üretilir. Logout akışı temizlik adımlarını `finally` benzeri garantiyle tamamlamayı hedefler; remote sign-out hatası temizlikten sonra yüzeye çıkar.

## Edge ve medya concurrency sınırı

Genel JSON Edge Function taşıyıcısı isteği bir kez gönderir; 15 saniye varsayılan timeout, request ID ve opsiyonel `Idempotency-Key` taşır. Otomatik gateway→direct fallback veya genel mutasyon retry yoktur. Bu, aynı mutasyonun iki origin'e yazılması riskini azaltır.

Medya katmanı kontrollü geçici hata/oturum yenileme retry'si uygular ve byte upload'ını imzalı URL ile doğrudan Storage'a yapar. Private signed-read sonuçları oturum nesli değiştiğinde kabul edilmez. Backend'in idempotency, nonce ve RLS sözleşmeleri migration/Edge Function tarafında ayrıca geçerli olmalıdır.

## Hata ve kullanıcı görünürlüğü

- Offline/cache sonucu son-bilinen veri olarak ele alınmalı; başarılı sunucu kaydı gibi sunulmamalıdır.
- Outbox durumu pending/running/failed/blocked/cancelled/done modeline sahiptir; kalıcı başarısızlık sessizce düşürülmez.
- `401/403` otomatik retry ile gizlenmez; oturum/yetki akışı çözmelidir.
- `409/422` çakışma veya doğrulama hatasıdır; genel retry yapılmaz.
- Loglara ham payload, token, imzalı URL veya kullanıcı tanımlayıcısı taşınmamalıdır.

## Doğrulama ve NO-GO kapıları

Kaynak/birim testleri aşağıdaki davranışları kapsar: retry sınıflandırması, `Retry-After`, outbox sıralama/dedupe/dependency/backoff, kullanıcı başına single-flight replay, cache sınırları/bozuk payload temizliği, refresh single-flight, signed URL oturum nesli/purge ve auth state purge.

Buna rağmen şu gerçek koşullar test kanıtı olmadan `UNVERIFIED`dır:

- Fiziksel cihazda uçak modu → işlem → uygulamayı öldürme → yeniden açma → replay.
- Wi-Fi/hücresel ağ salınımı ve `constrained` probe davranışı.
- Aynı hesapla iki cihazda eşzamanlı like/follow/list/media düzenleme.
- Kullanıcı A'dan çıkıp B'ye girerken cache, Realtime, signed URL ve outbox izolasyonu.
- Token expiry anında eşzamanlı API/media/auth lifecycle çağrıları.
- Canlı RLS, nonce, rate-limit, idempotency ve hesap silme sagasıyla uçtan uca bütünlük.

Bu cihaz ve canlı backend matrisi tamamlanmadan offline/concurrency yayın kararı `NO-GO`dur.
