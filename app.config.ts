import 'dotenv/config';

import type { ExpoConfig } from 'expo/config';

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
const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ?? '';
const enablePushNotifications = process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === 'true';

const config: ExpoConfig = {
  name: 'SoRita',
  slug: 'sorita',
  owner: 'cayan',
  version: '1.0.0',
  newArchEnabled: false,
  orientation: 'portrait',
  scheme: 'sorita',
  icon: './assets/app-icons_background_removed/playstore.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/app-icons_background_removed/playstore.png',
    resizeMode: 'contain',
    backgroundColor: '#f8fafc',
  },
  assetBundlePatterns: ['**/*'],
  plugins: [
    'expo-notifications',
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
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
        iosGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
  ],
  android: {
    package: 'com.cayan.sorita.socialmap',
    versionCode: 3,
    usesCleartextTraffic: false,
    softwareKeyboardLayoutMode: 'resize',
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
    expoProjectId,
    enablePushNotifications,
    authRedirectPath: 'auth/callback',
  },
};

export default config;
