import * as dotenv from 'dotenv';

import type { ExpoConfig } from 'expo/config';

dotenv.config({ override: true });

const requiredExpoPublicEnvVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;
const missingExpoPublicEnvVars = requiredExpoPublicEnvVars.filter((name) => {
  const value = process.env[name];
  return typeof value !== 'string' || value.trim().length === 0;
});

if (missingExpoPublicEnvVars.length > 0) {
  const message =
    `Missing required Expo public env vars: ${missingExpoPublicEnvVars.join(', ')}. ` +
    'If this build runs on EAS, add them to EAS Environment Variables or Secrets before building.';

  if (process.env.CI === 'true' || process.env.EAS_BUILD === 'true') {
    throw new Error(message);
  }

  console.warn(message);
}

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const supabaseDeleteUserFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_DELETE_USER_FUNCTION_NAME ?? 'delete-user';
const authWebOrigin =
  process.env.EXPO_PUBLIC_AUTH_WEB_ORIGIN ?? 'https://cayankuzu.github.io/SoRita_web';
const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ?? '';
const enablePushNotifications = process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === 'true';
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const sentryOrg = process.env.SENTRY_ORG ?? '';
const sentryProject = process.env.SENTRY_PROJECT ?? '';
const sentryUrl = process.env.SENTRY_URL ?? '';
const sentryPluginEnabled = Boolean(sentryOrg && sentryProject && sentryUrl);

const config: ExpoConfig = {
  name: 'SoRita',
  slug: 'sorita',
  owner: 'cayan',
  version: '1.0.41',
  newArchEnabled: false,
  orientation: 'portrait',
  scheme: 'sorita',
  icon: './assets/app-icons_background_removed/playstore.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash/launch-splash.png',
    resizeMode: 'cover',
    backgroundColor: '#f8fafc',
  },
  assetBundlePatterns: ['**/*'],
  plugins: [
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f8fafc',
        image: './assets/splash/launch-splash.png',
        resizeMode: 'cover',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'SoRita, yakinindaki mekanlari gosterebilmek ve harita deneyimini iyilestirmek icin konumunuzu kullanir.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'SoRita, profilinize ve paylasimlariniza fotograf ekleyebilmeniz icin fotograf kitapliginiza erisim ister.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'SoRita, fotograf ve videolari liste kartlarina ekleyebilmeniz icin galerinizdeki iceriklere erisim ister.',
        savePhotosPermission:
          'SoRita, kamera ile eklediginiz icerikleri isterseniz galerinizde de saklayabilmeniz icin kaydetme izni ister.',
        granularPermissions: ['photo', 'video'],
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
        iosGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
    ...(sentryPluginEnabled
      ? [[
          '@sentry/react-native/expo',
          {
            url: sentryUrl,
            organization: sentryOrg,
            project: sentryProject,
          },
        ] as const]
      : []),
  ],
  android: {
    package: 'com.cayan.sorita.socialmap',
    versionCode: 46,
    usesCleartextTraffic: false,
    softwareKeyboardLayoutMode: 'resize',
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
    permissions: ['INTERNET', 'ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
    adaptiveIcon: {
      foregroundImage: './assets/app-icons_background_removed/playstore.png',
      backgroundColor: '#ffffff',
    },
  },
  ios: {
    bundleIdentifier: 'com.cayan.sorita.socialmap',
    buildNumber: '27',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'SoRita, yakinindaki mekanlari gosterebilmek ve harita deneyimini iyilestirmek icin konumunuzu kullanir.',
      NSPhotoLibraryUsageDescription:
        'SoRita, profilinize ve paylasimlariniza fotograf ekleyebilmeniz icin fotograf kitapliginiza erisim ister.',
      NSPhotoLibraryAddUsageDescription:
        'SoRita, sectiginiz gorselleri uygulama icerisinde kullanabilmeniz icin fotograf kitapliginiza kaydetme izni isteyebilir.',
    },
    config: {
      googleMapsApiKey,
    },
  },
  extra: {
    eas: {
      projectId: expoProjectId,
    },
    googleMapsApiKey,
    supabaseUrl,
    supabasePublishableKey,
    supabaseDeleteUserFunctionName,
    authWebOrigin,
    expoProjectId,
    enablePushNotifications,
    sentryDsn,
    authRedirectPath: 'auth/callback',
  },
};

export default config;
