import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import {
  getPublicRuntimeConfigIssueEnvNames,
  publicRuntimeConfigSchema,
} from '@/mobile/app/platform/config/publicRuntimeConfig';

type ExpoExtraConfig = {
  googleMapsApiKey?: string;
  googleMapsAndroidApiKey?: string;
  googleMapsIosApiKey?: string;
  googleMapsStaticApiKey?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseDeleteUserFunctionName?: string;
  supabaseMediaAssetsFunctionName?: string;
  supabaseAuthGatewayFunctionName?: string;
  supabaseModerationReportsFunctionName?: string;
  supabasePersonalDataFunctionName?: string;
  supabaseMapsFunctionName?: string;
  appScheme?: string;
  appLinkDomain?: string;
  facebookAppId?: string;
  expoProjectId?: string;
  enablePushNotifications?: boolean | string;
  systemNotificationFcmTopic?: string;
  authRedirectPath?: string;
  sentryDsn?: string;
  posthogProjectApiKey?: string;
  posthogHost?: string;
  productAnalyticsEnabled?: boolean | string;
  edgeApiUrl?: string;
  edgeCutoverMode?: string;
  releaseEnvironment?: string;
  publicWebUrl?: string;
};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExpoExtraConfig;
const authRedirectPath = expoExtra.authRedirectPath ?? 'auth/callback';
const publicRuntimeConfigResult = publicRuntimeConfigSchema.safeParse({
  appLinkDomain: expoExtra.appLinkDomain,
  edgeApiUrl: expoExtra.edgeApiUrl,
  edgeCutoverMode: expoExtra.edgeCutoverMode,
  releaseEnvironment: expoExtra.releaseEnvironment,
  posthogHost: expoExtra.posthogHost,
  productAnalyticsEnabled: expoExtra.productAnalyticsEnabled,
  publicWebUrl: expoExtra.publicWebUrl,
});
const publicRuntimeConfig = publicRuntimeConfigResult.success
  ? publicRuntimeConfigResult.data
  : {
      appLinkDomain: '',
      edgeApiUrl: '',
      edgeCutoverMode: 'direct' as const,
      releaseEnvironment: 'development' as const,
      posthogHost: '',
      productAnalyticsEnabled: false,
      publicWebUrl: '',
    };
const missingRequiredStartupEnvVars = [
  !expoExtra.supabaseUrl ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
  !expoExtra.supabasePublishableKey ? 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : null,
  ...(!publicRuntimeConfigResult.success
    ? getPublicRuntimeConfigIssueEnvNames(publicRuntimeConfigResult.error)
    : []),
].filter((value): value is string => Boolean(value));

function parsePushNotificationsEnabled(value: ExpoExtraConfig['enablePushNotifications']) {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return null;
}

const pushNotificationsEnabledOverride = parsePushNotificationsEnabled(
  expoExtra.enablePushNotifications,
);

function resolveGoogleMapsApiKey() {
  if (Platform.OS === 'ios') {
    return expoExtra.googleMapsIosApiKey ?? expoExtra.googleMapsApiKey ?? '';
  }

  if (Platform.OS === 'android') {
    return expoExtra.googleMapsAndroidApiKey ?? expoExtra.googleMapsApiKey ?? '';
  }

  return expoExtra.googleMapsApiKey ?? expoExtra.googleMapsAndroidApiKey ?? expoExtra.googleMapsIosApiKey ?? '';
}

export const env = {
  isExpoGo: Constants.appOwnership === 'expo',
  googleMapsApiKey: resolveGoogleMapsApiKey(),
  googleMapsStaticApiKey: expoExtra.googleMapsStaticApiKey ?? '',
  supabaseUrl: expoExtra.supabaseUrl ?? '',
  supabasePublishableKey: expoExtra.supabasePublishableKey ?? '',
  supabaseDeleteUserFunctionName: expoExtra.supabaseDeleteUserFunctionName ?? 'delete-user',
  supabaseMediaAssetsFunctionName: expoExtra.supabaseMediaAssetsFunctionName ?? 'media-assets',
  supabaseAuthGatewayFunctionName: expoExtra.supabaseAuthGatewayFunctionName ?? 'auth-gateway',
  supabaseModerationReportsFunctionName:
    expoExtra.supabaseModerationReportsFunctionName ?? 'moderation-reports',
  supabasePersonalDataFunctionName:
    expoExtra.supabasePersonalDataFunctionName ?? 'personal-data',
  supabaseMapsFunctionName: expoExtra.supabaseMapsFunctionName ?? 'maps-geocoding',
  appScheme: expoExtra.appScheme ?? 'sorita',
  appLinkDomain: publicRuntimeConfig.appLinkDomain,
  facebookAppId: expoExtra.facebookAppId ?? '',
  pushNotificationsEnabledOverride,
  expoProjectId:
    expoExtra.expoProjectId ||
    Constants.easConfig?.projectId ||
    ((Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? ''),
  systemNotificationFcmTopic: expoExtra.systemNotificationFcmTopic ?? 'system-all-users-v1',
  authRedirectPath,
  authRedirectUrl: Linking.createURL(authRedirectPath),
  sentryDsn: expoExtra.sentryDsn ?? '',
  // A PostHog project API key is public client configuration, not a secret.
  // Never add personal, admin, or server-side keys to Expo extra.
  posthogProjectApiKey: expoExtra.posthogProjectApiKey?.trim() ?? '',
  posthogHost: publicRuntimeConfig.posthogHost,
  productAnalyticsEnabled: publicRuntimeConfig.productAnalyticsEnabled,
  publicWebUrl: publicRuntimeConfig.publicWebUrl,
  edgeApiUrl: publicRuntimeConfig.edgeApiUrl,
  edgeConfigValid: publicRuntimeConfigResult.success,
  edgeCutoverMode: publicRuntimeConfig.edgeCutoverMode,
  releaseEnvironment: publicRuntimeConfig.releaseEnvironment,
  hasRequiredStartupConfig: missingRequiredStartupEnvVars.length === 0,
  missingRequiredStartupEnvVars,
};
