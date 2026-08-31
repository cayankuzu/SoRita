# SoRita mevcut özellik sözleşmesi

Tarih: 2026-08-30
Durum: Repo içi statik sözleşme doğrulandı; canlı ortam ve cihaz davranışı `UNVERIFIED`; yayın `NO-GO`.

## Amaç ve sınır

Bu belge, SoRita'nın bu çalışma ağacında zaten bulunan ürün yüzeyini dondurur. Amaç yalnız mevcut özelliklerin güvenlik, dayanıklılık, performans, erişilebilirlik ve operasyonel kalitesini güçlendirmektir. Yeni ekran, rota, kullanıcı eylemi, bildirim türü, ürün tablosu, depolama kovası, izin veya genel API sözleşmesi bu çalışmanın parçası değildir.

Bağlayıcı makine okunur kaynak [feature-surface.snapshot.json](../quality/feature-surface.snapshot.json), denetleyici ise [check-no-new-product-surface.mjs](../utils/guards/check-no-new-product-surface.mjs) dosyasıdır. Bu belge açıklayıcı karşılığıdır. [baseline.md](baseline.md) ve 2026-08-17 tarihli yayın raporları tarihsel kanıttır; mevcut çalışma ağacına ait sayı veya yayın onayı olarak kullanılmaz.

## Mevcut ürün tanımı

SoRita; kullanıcıların harita, akış ve keşif üzerinden mekân/listeler bulduğu, kendi listelerini ve mekân kartlarını yönettiği, diğer kullanıcılarla takip, beğeni, yorum, yanıt ve bildirimler üzerinden etkileştiği React Native/Expo mobil uygulamasıdır. Supabase Auth, Postgres/RLS, Realtime, Storage ve Edge Functions veri düzlemini oluşturur.

Mevcut kullanıcı kabiliyetleri şunlardır:

- Hesap oluşturma, oturum açma, e-posta doğrulama/yeniden gönderme, parola sıfırlama, oturum kapatma ve hesap silme.
- Ana akış, keşif, harita, konuma bağlı mekân kartları, liste detayı, kendi profili ve başka kullanıcı profili.
- Liste ve mekân kartı oluşturma/düzenleme; fotoğraf/video, başlık, açıklama, konum ve menü bağlantısı kullanma.
- Liste/mekân beğenme, kullanıcı takip etme veya özel hesap için takip isteği gönderme.
- Yorum, yoruma yanıt ve yorum beğenisi.
- Uygulama içi ve sistem bildirimleri; bildirimden mevcut hedeflere yönlenme.
- Profil fotoğrafı/kapak, hesap gizliliği, parola, engellenen kullanıcılar, raporlama ve hesap silme ayarları.
- Çevrimdışı okunabilir sınırlı önbellek ile desteklenen mevcut yazma işlemlerinin dayanıklı outbox üzerinden sonradan eşitlenmesi.

Bu liste yeni bir ürün vaadi değildir; mevcut rota, veri ve test kaynaklarının özeti olarak okunmalıdır.

## Dondurulan gezinme yüzeyi

| Boyut | Sözleşme |
| --- | --- |
| Kök rotalar (10) | `Auth`, `AuthCallback`, `ListDetail`, `LocationPlaceCards`, `MainTabs`, `Notifications`, `ResetPassword`, `Settings`, `UICatalog`, `UserProfile` |
| Sekmeler (4) | `Explore`, `Home`, `Map`, `Profile` |
| Ekran girişleri (13) | `AuthScreen`, `AuthCallbackScreen`, `ExploreScreen`, `HomeScreen`, `ListDetailScreen`, `LocationPlaceCardsScreen`, `MapScreen`, `NotificationsScreen`, `ProfileScreen`, `ResetPasswordScreen`, `SettingsScreen`, `UiCatalogScreen`, `UserProfileScreen` |
| Ayar görünümleri (5) | `blocked`, `editProfile`, `main`, `password`, `privacy` |
| Görünür Ayarlar grupları (3) | hesap, diğer, geliştirici/UI kataloğu |
| Görünür Ayarlar CTA'ları | Snapshot'taki 19 çeviri anahtarı; ek CTA kabul edilmez |

Ekran girişlerinin rota-modül-export eşlemesi için tek doğruluk kaynağı snapshot'tır. `UICatalog` mevcut geliştirici yüzeyidir; bu sözleşme onu yeni son kullanıcı özelliği saymaz.

## Dondurulan bildirim ve yerel yetenek yüzeyi

Bildirim türleri (10): `comment`, `comment_like`, `comment_reply`, `follow`, `follow_request`, `like`, `list_liked`, `place_added`, `place_quote`, `system_announcement`.

Bildirim kategorileri (6): `all`, `comments`, `follows`, `likes`, `places`, `quotes`.

Expo Android izinleri: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `CAMERA`, `INTERNET`, `POST_NOTIFICATIONS`, `RECORD_AUDIO`. `SYSTEM_ALERT_WINDOW` açıkça engellenmiştir. Yerel izin eklentileri `expo-camera`, `expo-image-picker`, `expo-location`, `expo-media-library` ve `expo-notifications` ile sınırlıdır. iOS kullanım açıklamaları konum ve fotoğraf kitaplığıyla, arka plan modu ise `remote-notification` ile sınırlıdır. Tam Android manifest ayrıntıları snapshot ve [app.config.ts](../app.config.ts) içinde kayıtlıdır.

## Dondurulan HTTP, veri ve depolama yüzeyi

Edge Function sözleşmeleri (6):

- `admin-broadcast-notification` yalnız yönetim/operasyon sözleşmesidir.
- Mobil istemcinin kullandığı sözleşmeler `auth-gateway`, `delete-user`, `maps-geocoding`, `media-assets` ve `moderation-reports` ile sınırlıdır.

Ürün tabloları (18):

- `public.follow_requests`
- `public.list_likes`
- `public.list_place_comment_likes`
- `public.list_place_comment_reports`
- `public.list_place_comments`
- `public.list_place_likes`
- `public.list_place_photos`
- `public.list_place_reports`
- `public.list_places`
- `public.list_reports`
- `public.lists`
- `public.moderation_reports`
- `public.notifications`
- `public.profiles`
- `public.user_blocks`
- `public.user_follows`
- `public.user_push_tokens`
- `public.user_reports`

İç altyapı tabloları: `private.auth_login_guards`, `private.edge_rate_limits`, `private.push_delivery_jobs`, `private.system_broadcast_deliveries`, `public.account_deletion_jobs`, `public.request_nonces`.

Storage kovaları: `place-media`, `place-media-private`, `profile-media`.

## Bu çalışma kapsamında izin verilen güçlendirmeler

- Aynı kullanıcı eylemini koruyarak doğrulama, RLS, yetki, oran sınırı, nonce, idempotency ve veri bütünlüğü sertleştirmesi.
- Mevcut sorguların indeks, read model, sayfalama, önbellek ve ağ dayanıklılığı iyileştirmesi.
- Mevcut çevrimdışı işlemler için kuyruk, yeniden oynatma, çakışma ve kullanıcı sınırı güvenliği.
- Mevcut medya sözleşmesinde boyut/MIME doğrulaması, imzalı URL güvenliği, yükleme temizliği ve kısa ömürlü önbellek.
- Mevcut ekranlarda hata, boş, yükleniyor, erişilebilirlik ve küçük ekran davranışının düzeltilmesi.
- Var olan dağıtım yolları için kanıt, geri alma ve seçici edge güvenlik katmanı eklenmesi; ürün davranışı veya genel API yüzeyi genişlemeden.

## Kapsam dışı değişiklikler

Snapshot'a eklenen rota, ekran girişi, sekme, Ayarlar CTA'sı, bildirim türü/kategorisi, native izin/entitlement, ürün tablosu, storage kovası veya mobil Edge Function sözleşmesi yeni ürün yüzeyidir. Böyle bir değişiklik bu güçlendirme çalışmasına sessizce dahil edilemez.

İç tablo/işlev eklemesi ancak kullanıcıya yeni kabiliyet sunmuyorsa, adı ve kullanımı açıkça güvenlik/operasyon altyapısıysa ve guard'ın dar kapsamlı kuralından geçiyorsa kabul edilebilir. Guard'ın geçmesi tek başına ürün kararı değildir; insan incelemesi yine gereklidir.

## Değişiklik protokolü

1. Önce ürün kararı ve ayrı kapsam onayı alınır.
2. Snapshot bilinçli olarak güncellenir; koddan otomatik kopyalanıp onay gibi kullanılmaz.
3. Bu belge, veri envanteri, çevrimdışı sözleşme, gizlilik metinleri ve test matrisi birlikte güncellenir.
4. `npm run feature-surface:check` ve tam yayın kapıları aynı commit SHA üzerinde çalıştırılır.
5. Gerekli native izin/runtime değişikliği OTA olarak yayımlanmaz; yeni binary kanıtı gerekir.

## Kanıt sınırı ve karar

2026-08-30 tarihinde `npm run feature-surface:check` mevcut snapshot ile geçti. Bu, yalnız kaynak ağacı ve statik guard davranışına dair kanıttır.

- Canlı Supabase migration/RLS/Edge Function davranışı: `UNVERIFIED`.
- Cloudflare Worker dağıtımı, gerçek binding/secrets ve origin-HMAC cutover: `UNVERIFIED`.
- Android/iOS gerçek cihaz, izin, deep-link, kamera, video, konum ve push akışları: `UNVERIFIED`.
- EAS preview/production build ve OTA yayın/rollback: `UNVERIFIED`.

Sonuç: Mevcut ürün yüzeyi statik olarak dondurulmuştur; üretime hazır olduğuna dair karar `NO-GO`dur.
