# SoRita Continuity Model

Bu repo secret-less continuity modeli ile kullanilir.

## Kural

- Gercek secret'lar ve release signing dosyalari GitHub `main` branch'ine commit edilmez.
- Bunlar yalnizca masaustundeki veya sifreli USB icindeki `SoRita_secrests` klasorunde tutulur.
- Yeni makinede restore islemi `RESTORE-TO-PROJECT.ps1` ile yapilir.

## GitHub'da Kalir

- Tum kaynak kodu, testler, migration'lar, edge function kodu
- `package.json`, `package-lock.json`, `eas.json`, `app.config.ts`
- `google-services.json`, `android/app/google-services.json`, `GoogleService-Info.plist`
- `android/sentry.properties`
- `supabase/config.toml`
- Public veya client-visible config icin `.env.example`
- Public certificate artefaktlari:
  - `android/keystores/sorita-release-upload-cert.pem`
  - `android/keystores/sorita-upload-reset-20260426-upload-cert.pem`

## `SoRita_secrests` Klasorunde Kalir

- `.env`
- `credentials.json`
- `credentials\ios\dist-cert.p12`
- `credentials\ios\profile.mobileprovision`
- `android/keystore.properties`
- `android/keystores/sorita-release.jks`
- `android/keystores/sorita-upload-reset-20260426.jks`
- Varsa proje kokundeki `AuthKey_*.p8` dosyalari
- `android/keystores/sorita-upload-reset-20260426-info.txt`
- Varsa `apple\` altinda local App Store Connect `.p8` ve ilgili auth metadata dosyalari
- Varsa `firebase-admin\` altinda SoRita Firebase Admin service account JSON dosyalari
- `supabase\linked-project.json` ve `supabase\project-ref.txt` yerel proje baglantisi

## Neden Bu Ayrim Secildi

- Android release signing anahtari ve parolalari repo ele gecirilirse geri alinmasi en zor varliklardir.
- Admin token, service role key ve Sentry auth token gibi degerler sadece USB backup'ta tutulursa GitHub kompromize olsa bile etki alani daralir.
- Firebase client config dosyalari uygulama binary'sine de gomuldugu icin secret sayilmaz; continuity'yi basitlestirmek icin repoda tutulur.
- Public sertifikalar (`*.pem`) kimlik dogrulama ve key fingerprint kontrolu icin faydalidir, ancak private key icermez.

## Yeni Makinede Kurulum

```powershell
git clone https://github.com/cayankuzu/SoRita.git
cd SoRita
powershell -ExecutionPolicy Bypass -File "$HOME\Desktop\SoRita_secrests\RESTORE-TO-PROJECT.ps1" -ProjectRoot (Get-Location).Path
npm ci
npm run typecheck
npm run security:verify
```

Repo klasorunde mevcut dosyalari bilerek degistirmek istiyorsaniz restore komutuna `-Force` ekleyin.

## Android Build Komutlari

```powershell
npm run android
```

Native Android dogrulama:

```powershell
cd android
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:bundleRelease
```

Keystore fingerprint kontrolu:

```powershell
cd android
.\gradlew.bat :app:printReleaseSigningFingerprint
```

## iOS Notu

Bu repoda hazir bir `ios/` native proje yok. iOS native klasoru gerekirse:

```powershell
npx expo prebuild --platform ios
```

Mac olmayan makinelerde pratik yol:

```powershell
npx eas build --platform ios --profile production
```

iOS build continuity icin `credentials.json`, `credentials\ios\dist-cert.p12`, `credentials\ios\profile.mobileprovision` ve kullaniliyorsa `AuthKey_*.p8` dosyalarinin USB backup icinde bulunmasi gerekir.

## GitHub Variables / Secrets Politikasi

- GitHub Variables:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - diger gizli olmayan `EXPO_PUBLIC_*` sabitleri
- GitHub Secrets:
  - `EXPO_TOKEN`
  - CI/CD icin gereken diger gercek token veya secret'lar

## Export / Restore Akisi

- Proje kokunden `powershell -ExecutionPolicy Bypass -File .\continuity\EXPORT-SECRETS.ps1` calistirilarak `Desktop\SoRita_secrests` guncellenir.
- Export paketi `RECOVERY-README.md`, `FILE-INVENTORY.txt`, `ENV-KEYS.txt` ve `SHA256SUMS.txt` ureterek USB kopyasini dogrulamayi kolaylastirir.
- `SoRita_secrests\SHA256SUMS.txt` ile USB kopyasinin dosya butunlugunu dogrula.
- `RESTORE-TO-PROJECT.ps1` sadece continuity icin gereken dosyalari projeye geri kopyalar.
- `apple\` ve `firebase-admin\` altindaki ek credential dosyalari USB paketinde saklanir; restore scripti bunlari proje kokune otomatik kopyalamaz.
- Secret dosyalar restore edilmeden `npm ci` calisir, fakat release signing ve admin scriptleri eksik kalir.
- GitHub repo variables ve secrets listesi 2026-07-07 tarihinde bos gorundu. EAS production ortaminda `SENTRY_AUTH_TOKEN` tanimli. Supabase dashboard secret'lari kullaniliyorsa ayrica elle yedeklenmelidir.
