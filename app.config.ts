import * as dotenv from 'dotenv';

import type { ExpoConfig } from 'expo/config';

dotenv.config({ quiet: true });

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
const googleMapsAndroidApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ??
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ??
  googleMapsApiKey;
const googleMapsIosApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ??
  process.env.GOOGLE_MAPS_IOS_API_KEY ??
  googleMapsApiKey;
const googleMapsStaticApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_STATIC_API_KEY ??
  // Temporary config compatibility: the legacy value was only public because
  // it is embedded in Static Maps image URLs. Geocoding never consumes it.
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_SERVICES_API_KEY ??
  '';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const supabaseDeleteUserFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_DELETE_USER_FUNCTION_NAME ?? 'delete-user';
const supabaseMediaAssetsFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_MEDIA_ASSETS_FUNCTION_NAME ?? 'media-assets';
const supabaseAuthGatewayFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_AUTH_GATEWAY_FUNCTION_NAME ?? 'auth-gateway';
const supabaseModerationReportsFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_MODERATION_REPORTS_FUNCTION_NAME ?? 'moderation-reports';
const supabaseMapsFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_MAPS_FUNCTION_NAME ?? 'maps-geocoding';
const appScheme = 'sorita';
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '';
const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ?? '';
const enablePushNotifications = process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS;
const systemNotificationFcmTopic =
  process.env.EXPO_PUBLIC_SYSTEM_NOTIFICATION_FCM_TOPIC ?? 'system-all-users-v1';
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const sentryOrg = process.env.SENTRY_ORG ?? '';
const sentryProject = process.env.SENTRY_PROJECT ?? '';
const sentryUrl = process.env.SENTRY_URL ?? '';
const sentryPluginEnabled = Boolean(sentryOrg && sentryProject && sentryUrl);
const expoOwner =
  process.env.EXPO_OWNER?.trim() || process.env.EXPO_PUBLIC_EXPO_OWNER?.trim() || undefined;

type SoRitaExpoConfig = ExpoConfig & {
  newArchEnabled?: boolean;
};

const config: SoRitaExpoConfig = {
  name: 'SoRita',
  slug: 'sorita',
  ...(expoOwner ? { owner: expoOwner } : {}),
  version: '1.0.100',
  newArchEnabled: true,
  orientation: 'default',
  scheme: appScheme,
  icon: './assets/app-icons_background_removed/appstore.png',
  userInterfaceStyle: 'light',
  // OTA/runtime bundle: keep only assets required by JavaScript. Native app
  // icon catalogs and source variants must not be shipped as duplicate assets.
  assetBundlePatterns: [
    'assets/app-icons_background_removed/playstore.png',
    'assets/splash/launch-splash.png',
  ],
  plugins: [
    'expo-image',
    'expo-video',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        // Remote messages without an explicit channel use the same stable
        // channel as foreground/system notifications in new native builds.
        defaultChannel: 'sorita-alerts-v4',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f8fafc',
        android: {
          backgroundColor: '#f8fafc',
          image:
            './assets/app-icons_background_removed/android/adaptive-foreground.png',
          imageWidth: 160,
          resizeMode: 'contain',
        },
        ios: {
          backgroundColor: '#f8fafc',
          enableFullScreenImage_legacy: true,
          image: './assets/splash/launch-splash.png',
          resizeMode: 'cover',
        },
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          forceStaticLinking: ['FirebaseCoreInternal', 'RNFBApp', 'RNFBMessaging'],
          useFrameworks: 'static',
        },
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/messaging',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'SoRita, yakınınızdaki mekânları gösterebilmek ve harita deneyimini iyileştirmek için konumunuzu kullanır.',
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission:
          'SoRita, kameradan yeni fotoğraf ve video çekebilmeniz için kameranıza erişim ister.',
        microphonePermission:
          'SoRita, mekân kartlarına sesli video ekleyebilmeniz için mikrofonunuza erişim ister.',
        photosPermission:
          'SoRita, profilinize ve paylaşımlarınıza fotoğraf ekleyebilmeniz için fotoğraf kitaplığınıza erişim ister.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'SoRita, uygulama içi video kaydı alabilmeniz için kameranıza erişim ister.',
        microphonePermission:
          'SoRita, videolarınızdaki sesi kaydedebilmek için mikrofonunuza erişim ister.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'SoRita, fotoğraf ve videoları liste kartlarına ekleyebilmeniz için galerinizdeki içeriklere erişim ister.',
        savePhotosPermission:
          'SoRita, kamera ile eklediğiniz içerikleri isterseniz galerinizde de saklayabilmeniz için kaydetme izni ister.',
        granularPermissions: ['photo', 'video'],
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsAndroidApiKey,
        iosGoogleMapsApiKey: googleMapsIosApiKey,
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
        ] as [string, { organization: string; project: string; url: string }]]
      : []),
  ],
  android: {
    package: 'com.cayan.sorita.socialmap',
    googleServicesFile: './google-services.json',
    versionCode: 105,
    usesCleartextTraffic: false,
    softwareKeyboardLayoutMode: 'resize',
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    config: {
      googleMaps: {
        apiKey: googleMapsAndroidApiKey,
      },
    },
    permissions: [
      'INTERNET',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'POST_NOTIFICATIONS',
      'CAMERA',
      'RECORD_AUDIO',
    ],
    adaptiveIcon: {
      foregroundImage:
        './assets/app-icons_background_removed/android/adaptive-foreground.png',
      backgroundColor: '#ffffff',
    },
    icon: './assets/app-icons_background_removed/playstore.png',
  } as NonNullable<ExpoConfig['android']> & { usesCleartextTraffic: boolean },
  ios: {
    bundleIdentifier: 'com.cayan.sorita.socialmap',
    buildNumber: '85',
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      CFBundleDevelopmentRegion: 'tr',
      CFBundleLocalizations: ['tr'],
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'SoRita, yakınınızdaki mekânları gösterebilmek ve harita deneyimini iyileştirmek için konumunuzu kullanır.',
      NSPhotoLibraryUsageDescription:
        'SoRita, profilinize ve paylaşımlarınıza fotoğraf ekleyebilmeniz için fotoğraf kitaplığınıza erişim ister.',
      NSPhotoLibraryAddUsageDescription:
        'SoRita, seçtiğiniz görselleri uygulama içerisinde kullanabilmeniz için fotoğraf kitaplığınıza kaydetme izni isteyebilir.',
      UIBackgroundModes: ['remote-notification'],
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
    config: {
      googleMapsApiKey: googleMapsIosApiKey,
    },
  },
  extra: {
    eas: {
      projectId: expoProjectId,
    },
    googleMapsApiKey,
    googleMapsAndroidApiKey,
    googleMapsIosApiKey,
    googleMapsStaticApiKey,
    supabaseUrl,
    supabasePublishableKey,
    supabaseDeleteUserFunctionName,
    supabaseMediaAssetsFunctionName,
    supabaseAuthGatewayFunctionName,
    supabaseModerationReportsFunctionName,
    supabaseMapsFunctionName,
    appScheme,
    facebookAppId,
    expoProjectId,
    enablePushNotifications,
    systemNotificationFcmTopic,
    sentryDsn,
    authRedirectPath: 'auth/callback',
  },
};

export default config;
