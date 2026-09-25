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
const supabasePersonalDataFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_PERSONAL_DATA_FUNCTION_NAME ?? 'personal-data';
const supabaseMapsFunctionName =
  process.env.EXPO_PUBLIC_SUPABASE_MAPS_FUNCTION_NAME ?? 'maps-geocoding';
const appScheme = 'sorita';
const rawAppLinkDomain = process.env.EXPO_PUBLIC_APP_LINK_DOMAIN?.trim().toLowerCase() ?? '';
let appLinkDomain = '';

// A custom scheme remains the safe development fallback. Only opt a signed
// binary into Universal Links/App Links when the release environment supplies
// one canonical HTTPS host; never manufacture a host from another service URL.
if (rawAppLinkDomain) {
  try {
    const parsedAppLinkDomain = new URL(`https://${rawAppLinkDomain}`);
    if (
      parsedAppLinkDomain.hostname !== rawAppLinkDomain ||
      parsedAppLinkDomain.port ||
      parsedAppLinkDomain.username ||
      parsedAppLinkDomain.password ||
      parsedAppLinkDomain.pathname !== '/' ||
      parsedAppLinkDomain.search ||
      parsedAppLinkDomain.hash ||
      rawAppLinkDomain === 'localhost' ||
      rawAppLinkDomain.endsWith('.localhost')
    ) {
      throw new Error('unsafe_domain');
    }
    appLinkDomain = parsedAppLinkDomain.hostname;
  } catch {
    throw new Error(
      'Invalid app-link configuration: EXPO_PUBLIC_APP_LINK_DOMAIN must be one HTTPS hostname without a scheme, path, port, credentials, query, or fragment.',
    );
  }
}
const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? '';
const expoProjectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim() ?? '';
const rawEnablePushNotifications =
  process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS?.trim().toLowerCase();
const enablePushNotifications = rawEnablePushNotifications || undefined;

if (
  enablePushNotifications !== undefined &&
  enablePushNotifications !== 'true' &&
  enablePushNotifications !== 'false'
) {
  throw new Error(
    'Invalid push notification configuration: EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS must be true or false.',
  );
}
const systemNotificationFcmTopic =
  process.env.EXPO_PUBLIC_SYSTEM_NOTIFICATION_FCM_TOPIC ?? 'system-all-users-v1';
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
const posthogProjectApiKey = process.env.EXPO_PUBLIC_POSTHOG_PROJECT_API_KEY?.trim() ?? '';
const rawPosthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() ?? '';
const rawEnableProductAnalytics = process.env.EXPO_PUBLIC_ENABLE_PRODUCT_ANALYTICS?.trim().toLowerCase();
const productAnalyticsEnabled = rawEnableProductAnalytics === 'true';
const sentryOrg = process.env.SENTRY_ORG ?? '';
const sentryProject = process.env.SENTRY_PROJECT ?? '';
const sentryUrl = process.env.SENTRY_URL ?? '';
const sentryPluginEnabled = Boolean(sentryOrg && sentryProject && sentryUrl);
const expoOwner =
  process.env.EXPO_OWNER?.trim() || process.env.EXPO_PUBLIC_EXPO_OWNER?.trim() || undefined;
const easBuildProfile = process.env.EAS_BUILD_PROFILE?.trim().toLowerCase();
const releaseEnvironmentCandidate =
  process.env.EXPO_PUBLIC_RELEASE_ENVIRONMENT?.trim() ||
  (easBuildProfile === 'development' ||
  easBuildProfile === 'preview' ||
  easBuildProfile === 'production'
    ? easBuildProfile
    : undefined);
const edgeCutoverMode = process.env.EXPO_PUBLIC_EDGE_CUTOVER_MODE?.trim().toLowerCase() || 'direct';
const releaseEnvironment = releaseEnvironmentCandidate?.toLowerCase() || 'development';
const rawEdgeApiUrl = process.env.EXPO_PUBLIC_EDGE_API_URL?.trim() ?? '';

if (
  rawEnableProductAnalytics !== undefined &&
  rawEnableProductAnalytics !== 'true' &&
  rawEnableProductAnalytics !== 'false'
) {
  throw new Error(
    'Invalid product analytics configuration: EXPO_PUBLIC_ENABLE_PRODUCT_ANALYTICS must be true or false.',
  );
}

if (edgeCutoverMode !== 'direct' && edgeCutoverMode !== 'gateway') {
  throw new Error('Invalid public runtime configuration: edgeCutoverMode must be direct or gateway.');
}

if (
  releaseEnvironment !== 'development' &&
  releaseEnvironment !== 'preview' &&
  releaseEnvironment !== 'production'
) {
  throw new Error(
    'Invalid public runtime configuration: releaseEnvironment must be development, preview, or production.',
  );
}

if (
  expoProjectId &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(expoProjectId)
) {
  throw new Error(
    'Invalid EAS Update configuration: EXPO_PUBLIC_EXPO_PROJECT_ID must be a UUID.',
  );
}

if (releaseEnvironment === 'production' && !expoProjectId) {
  throw new Error(
    'Invalid EAS Update configuration: EXPO_PUBLIC_EXPO_PROJECT_ID is required for production.',
  );
}

const expoUpdatesUrl = expoProjectId ? `https://u.expo.dev/${expoProjectId}` : undefined;

let edgeApiUrl = '';
let posthogHost = '';

if (rawEdgeApiUrl) {
  try {
    const parsedEdgeApiUrl = new URL(rawEdgeApiUrl);

    if (
      parsedEdgeApiUrl.protocol !== 'https:' ||
      parsedEdgeApiUrl.username ||
      parsedEdgeApiUrl.password ||
      parsedEdgeApiUrl.pathname !== '/' ||
      parsedEdgeApiUrl.search ||
      parsedEdgeApiUrl.hash
    ) {
      throw new Error('unsafe_url');
    }

    edgeApiUrl = parsedEdgeApiUrl.origin;
  } catch {
    throw new Error(
      'Invalid public runtime configuration: Edge API URL must be an HTTPS origin without credentials, path, query, or fragment.',
    );
  }
}

if (edgeCutoverMode === 'gateway' && !edgeApiUrl) {
  throw new Error(
    'Invalid public runtime configuration: Edge API URL is required when gateway cutover mode is enabled.',
  );
}

if (rawPosthogHost) {
  try {
    const parsedPosthogHost = new URL(rawPosthogHost);
    if (
      parsedPosthogHost.protocol !== 'https:' ||
      parsedPosthogHost.username ||
      parsedPosthogHost.password ||
      parsedPosthogHost.pathname !== '/' ||
      parsedPosthogHost.search ||
      parsedPosthogHost.hash
    ) {
      throw new Error('unsafe_url');
    }

    posthogHost = parsedPosthogHost.origin;
  } catch {
    throw new Error(
      'Invalid product analytics configuration: PostHog host must be an HTTPS origin without credentials, path, query, or fragment.',
    );
  }
}

const publicRuntimeConfig = {
  appLinkDomain,
  edgeApiUrl,
  edgeCutoverMode,
  releaseEnvironment,
  posthogHost,
  productAnalyticsEnabled,
};

// Every shipped binary embeds this string, and an update reaches only the
// binaries that embed the same one. It therefore tracks the native surface,
// not the release number: it stays put across JavaScript-only releases and
// moves only when a build changes what the native side can do.
const nativeRuntimeVersion = '1.0.108';

type SoRitaExpoConfig = ExpoConfig & {
  newArchEnabled?: boolean;
};

const config: SoRitaExpoConfig = {
  name: 'SoRita',
  slug: 'sorita',
  ...(expoOwner ? { owner: expoOwner } : {}),
  version: '1.0.110',
  newArchEnabled: true,
  // Every screen is laid out for portrait. The lock lives in the native
  // projects too, so a rotated phone never lays a screen out sideways before
  // JavaScript starts.
  orientation: 'portrait',
  scheme: appScheme,
  icon: './assets/app-icons_background_removed/appstore.png',
  userInterfaceStyle: 'light',
  // OTA/runtime bundle: keep only assets required by JavaScript. Native app
  // icon catalogs and source variants must not be shipped as duplicate assets.
  assetBundlePatterns: [
    'assets/app-icons_background_removed/playstore.png',
    'assets/splash/launch-splash.png',
  ],
  // The runtime version is the native contract, not the marketing version: an
  // update only reaches a binary that embeds the same string. Tying it to
  // `version` meant every release cut the installed base off from every update
  // published afterwards - Play was serving 1.0.108 while updates went to
  // 1.0.109, so the store build asked for an update and was told there was
  // none. Bump this only when the native surface changes, and rebuild the
  // binaries when you do. EAS Update rejects runtime policies in bare
  // projects, so it is a literal that native-parity:check pins to strings.xml.
  runtimeVersion: nativeRuntimeVersion,
  updates: {
    // With a zero launch wait, a newly downloaded update is applied on the
    // next cold start while the embedded/cached update remains the fallback.
    enabled: Boolean(expoUpdatesUrl),
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    useEmbeddedUpdate: true,
    ...(expoUpdatesUrl
      ? {
          requestHeaders: { 'expo-channel-name': releaseEnvironment },
          url: expoUpdatesUrl,
        }
      : {}),
  },
  plugins: [
    'expo-image',
    'expo-localization',
    'expo-video',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        // Android draws the status-bar icon from alpha alone: the colour logo
        // on white showed as a white square. This is the monochrome glyph,
        // tinted with the primary blue in the notification shade.
        color: '#2563eb',
        icon: './assets/notifications/notification-icon-mono.png',
        // Remote messages without an explicit channel use the same stable
        // channel as foreground/system notifications in new native builds.
        defaultChannel: 'sorita-alerts-v5',
        // Keep generated entitlements deterministic for each signed build
        // class. Internal preview builds use distribution provisioning and
        // therefore the production APNs environment, like App Store builds.
        mode: releaseEnvironment === 'development' ? 'development' : 'production',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f8fafc',
        // The tracked Android theme (res/values/styles.xml) shows no icon on the
        // system splash, so only the JavaScript splash with the logo and
        // copyright line is seen; this image is used by prebuild alone.
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
    // react-native-firebase 26 resolves Firebase through Swift Package Manager
    // by default, and refuses SPM under the static frameworks set above: each
    // pod would embed its own Firebase copy and collide at link time. CocoaPods
    // is how every iOS build before 26 resolved it, so this restores that path
    // rather than changing linkage. Android is unaffected; it builds from the
    // tracked android/ project and never reads this plugin option.
    ['@react-native-firebase/app', { ios: { disableSPM: true } }],
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
    versionCode: 116,
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
    ...(appLinkDomain
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              category: ['BROWSABLE', 'DEFAULT'],
              data: [{ scheme: 'https', host: appLinkDomain, pathPrefix: '/' }],
            },
          ],
        }
      : {}),
  } as NonNullable<ExpoConfig['android']> & { usesCleartextTraffic: boolean },
  ios: {
    bundleIdentifier: 'com.cayan.sorita.socialmap',
    buildNumber: '95',
    googleServicesFile: './GoogleService-Info.plist',
    ...(appLinkDomain ? { associatedDomains: [`applinks:${appLinkDomain}`] } : {}),
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
    supabasePersonalDataFunctionName,
    supabaseMapsFunctionName,
    appScheme,
    appLinkDomain: publicRuntimeConfig.appLinkDomain,
    facebookAppId,
    expoProjectId,
    enablePushNotifications,
    systemNotificationFcmTopic,
    sentryDsn,
    posthogProjectApiKey,
    posthogHost: publicRuntimeConfig.posthogHost,
    productAnalyticsEnabled: publicRuntimeConfig.productAnalyticsEnabled,
    authRedirectPath: 'auth/callback',
    edgeApiUrl: publicRuntimeConfig.edgeApiUrl,
    edgeCutoverMode: publicRuntimeConfig.edgeCutoverMode,
    releaseEnvironment: publicRuntimeConfig.releaseEnvironment,
  },
};

export default config;
