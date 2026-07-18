# SoRita

Harita tabanli sosyal mekan kesfetme mobil uygulamasi. Kullanicilar favori mekanlarini listeleyebilir, paylasabilir ve baskalarinin onerileriyle yeni yerler kesfedebilir.

## Teknoloji Yigini

| Katman | Teknoloji |
|--------|-----------|
| Framework | React Native 0.83 + Expo SDK 55 |
| Dil | TypeScript 5.9 (strict mode) |
| State | TanStack React Query v5 |
| Backend | Supabase (PostgreSQL + Edge Functions + Auth + Storage) |
| Harita | react-native-maps + Google Maps API |
| Navigasyon | React Navigation 6 (Native Stack + Bottom Tabs) |
| Test | Vitest 4 |
| CI/CD | GitHub Actions + EAS Build |
| Izleme | Sentry |

## Mimari

Feature-sliced mimari deseni kullanilir. Her feature asagidaki yapiya sahiptir:

```
src/mobile/app/
  app-shell/         # Auth, navigation, providers, startup
  data/              # Query client, repositories, mappers, selectors
  features/
    auth/            # Kimlik dogrulama akislari
    discovery/       # Kesfet grid bilesenleri
    explore/         # Kesfet ekrani
    home/            # Ana sayfa feed
    lists/           # Liste detay ve duzenleyici
    map/             # Harita ekrani ve mekan editoru
    notifications/   # Bildirim ekrani
    places/          # Mekan karti bilesenleri
    profile/         # Profil ve kullanici profili
    settings/        # Ayarlar ekrani
    social/          # Like, yorum, feed action bar
  platform/          # Cihaz servisleri (media, network, analytics, security)
  shared/            # Ortak bilesenler, tema, i18n, hooks, utils
```

Katman bagimliligi: `UI -> Application (hooks) -> Data (repositories) -> Platform (Supabase/API)`

## Kurulum

### Onkosuller

- Node.js 20+
- npm 10+
- Android Studio (Android AVD icin) veya Xcode (iOS icin)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Supabase CLI: `npm install -g supabase` veya `npx supabase`

### Continuity Notlari

- Bu repo secret-less continuity modeli ile kullanilir. Gercek `.env`, release keystore ve keystore parolalari GitHub `main` branch'inde tutulmaz.
- Gerekli lokal secret/signing dosyalari `SoRita_secrests` klasorunde tutulur ve `RESTORE-TO-PROJECT.ps1` ile geri yuklenir.
- `EXPORT-SECRETS.ps1`, bu makinede bulunuyorsa local App Store Connect `.p8` dosyalarini ve SoRita Firebase Admin service account JSON dosyalarini da ayni continuity paketine ekler.
- `google-services.json`, `android/app/google-services.json` ve `GoogleService-Info.plist` client config dosyalaridir; build continuity'yi basitlestirmek icin repoda kalirlar.
- Android native proje vardir. Hazir bir `ios/` native klasoru repoda yoktur; iOS native proje gerekiyorsa `npx expo prebuild --platform ios` ile uretilmeli veya dogrudan EAS iOS build kullanilmalidir.
- Ayrintili akis icin [CONTINUITY_MODEL.md](./CONTINUITY_MODEL.md) dosyasina bakiniz.
- Guncel secret paketi projeden `powershell -ExecutionPolicy Bypass -File .\continuity\EXPORT-SECRETS.ps1` ile yeniden uretilir.

### Adimlar

```bash
# 1. Depoyu klonla
git clone https://github.com/cayankuzu/SoRita.git
cd SoRita

# 2. USB secret paketini restore et
powershell -ExecutionPolicy Bypass -File "$HOME\Desktop\SoRita_secrests\RESTORE-TO-PROJECT.ps1" -ProjectRoot (Get-Location).Path

# 3. Bagimliliklari yukle
npm ci

# 4. EAS oturumunu dogrula
eas whoami

# 5. Supabase CLI oturumu ac
supabase login

# 6. Supabase projesini linkle / dogrula
npx supabase link --project-ref csidemtcbvtcmmjextey
```

Yeni bir bilgisayarda minimum devam komutlari:

```bash
git clone https://github.com/cayankuzu/SoRita.git
cd SoRita
powershell -ExecutionPolicy Bypass -File "$HOME\Desktop\SoRita_secrests\RESTORE-TO-PROJECT.ps1" -ProjectRoot (Get-Location).Path
npm ci
npx expo start
```

### Gerekli Ortam Degiskenleri

| Degisken | Aciklama |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje URL'i |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API anahtari |
| `EXPO_PUBLIC_GOOGLE_MAPS_SERVICES_API_KEY` | Google Maps Services API anahtari |
| `EXPO_PUBLIC_EXPO_PROJECT_ID` | EAS proje ID'si |
| `EXPO_OWNER` | Expo hesabinin kullanici adi (opsiyonel, hesap degisimi icin faydali) |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN (opsiyonel) |
| `EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS` | Push bildirimleri (`true`/`false`) |

Notlar:

- Gercek `.env` dosyasi repoda tutulmaz; `SoRita_secrests` klasorunden restore edilir.
- GitHub Actions tarafinda gizli olmayan `EXPO_PUBLIC_*` sabitleri repo Variables olarak, gercek token ve admin secret'lar repo Secrets olarak tutulmalidir.

## Calistirma

```bash
# Metro bundler'i baslat
npx expo start

# Android emulatorunde calistir
npm run android

# Android native build + calistir
npm run android:rebuild

# Metro cache temizle
npm run clean:metro
```

## Supabase Deploy

```bash
# Tum migration'lari linkli projeye uygula
npx supabase db push --linked --include-all

# Guncel edge function'lari deploy et
npx supabase functions deploy auth-gateway --project-ref csidemtcbvtcmmjextey
npx supabase functions deploy delete-user --project-ref csidemtcbvtcmmjextey
npx supabase functions deploy maps-geocoding --project-ref csidemtcbvtcmmjextey
npx supabase functions deploy media-assets --project-ref csidemtcbvtcmmjextey
npx supabase functions deploy moderation-reports --project-ref csidemtcbvtcmmjextey
npx supabase functions deploy admin-broadcast-notification --project-ref csidemtcbvtcmmjextey --no-verify-jwt
```

Notlar:

- `supabase db push` icin CLI oturumu ve hedef proje veritabani sifresi gerekir.
- Edge Function deploy icin `SUPABASE_ACCESS_TOKEN` veya aktif `supabase login` oturumu gerekir.
- `SUPABASE_SERVICE_ROLE_KEY` gibi server-side secret'lar repo yerine Supabase project secrets veya CI environment tarafinda tutulmalidir.

## Test

```bash
# Tum testleri calistir
npm test

# TypeScript tip kontrolu
npm run typecheck

# Guvenlik testleri
npm run security:verify

# Tek bir feature'in testlerini calistir
npm run test:feature:auth
npm run test:feature:home
npm run test:feature:social
# ... (tum feature'lar icin benzer komutlar mevcut)

# Coverage raporu
npm run test:coverage
```

## Build & Deploy

```bash
# EAS ile Android preview build
eas build --platform android --profile preview

# Android production AAB
eas build --platform android --profile production

# EAS ile iOS preview build
eas build --platform ios --profile preview

# Production build
eas build --platform all --profile production

# App Store / Play Store'a gonder
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

iOS notu:

- Repo icinde hazir `ios/` native projesi yoktur.
- Lokal iOS native klasoru gerekiyorsa `npx expo prebuild --platform ios` calistirilmalidir.
- Mac olmayan makinelerde iOS icin pratik yol EAS cloud build akisidir.

## Proje Yapisi

```
.
├── .github/workflows/     # CI/CD pipeline
├── android/               # Android native konfigurasyonu
├── assets/                # Uygulama ikonu, splash screen
├── src/
│   ├── mobile/app/        # Ana uygulama kodu
│   └── shared/            # Client + Edge Function paylasilan kod
├── supabase/
│   ├── functions/         # Edge Functions
│   └── migrations/        # Veritabani migration'lari
├── utils/                 # Gelistirici yardimci scriptleri
├── app.config.ts          # Expo yapilandirmasi
├── eas.json               # EAS Build profilleri
├── tsconfig.json          # TypeScript yapilandirmasi
└── vitest.config.ts       # Test yapilandirmasi
```

## Guvenlik

- Auth token'lar `expo-secure-store` (Keychain/Keystore) ile saklanir
- Tum Edge Function cagrilari HMAC ile imzalanir
- Nonce + timestamp ile replay attack koruması
- IP bazli rate limiting
- Zod ile girdi dogrulama
- PII redaction loglama
- Supabase Row Level Security (RLS)
- Icerik moderasyonu

Detayli guvenlik kontrol listesi icin [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) dosyasina bakiniz.

## Lisans

Bu proje ozel lisanslidir. Tum haklar saklidir.
