import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

type ExpoExtraConfig = {
  googleMapsApiKey?: string;
  googleMapsAndroidApiKey?: string;
  googleMapsIosApiKey?: string;
  googleMapsServicesApiKey?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseDeleteUserFunctionName?: string;
  supabaseMediaAssetsFunctionName?: string;
  supabaseAuthGatewayFunctionName?: string;
  supabaseModerationReportsFunctionName?: string;
  supabaseMapsFunctionName?: string;
  authWebOrigin?: string;
  facebookAppId?: string;
  expoProjectId?: string;
  enablePushNotifications?: boolean | string;
  systemNotificationFcmTopic?: string;
  authRedirectPath?: string;
  sentryDsn?: string;
};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExpoExtraConfig;
const authRedirectPath = expoExtra.authRedirectPath ?? 'auth/callback';
const missingRequiredStartupEnvVars = [
  !expoExtra.supabaseUrl ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
  !expoExtra.supabasePublishableKey ? 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' : null,
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
  googleMapsServicesApiKey: expoExtra.googleMapsServicesApiKey ?? '',
  supabaseUrl: expoExtra.supabaseUrl ?? '',
  supabasePublishableKey: expoExtra.supabasePublishableKey ?? '',
  supabaseDeleteUserFunctionName: expoExtra.supabaseDeleteUserFunctionName ?? 'delete-user',
  supabaseMediaAssetsFunctionName: expoExtra.supabaseMediaAssetsFunctionName ?? 'media-assets',
  supabaseAuthGatewayFunctionName: expoExtra.supabaseAuthGatewayFunctionName ?? 'auth-gateway',
  supabaseModerationReportsFunctionName:
    expoExtra.supabaseModerationReportsFunctionName ?? 'moderation-reports',
  supabaseMapsFunctionName: expoExtra.supabaseMapsFunctionName ?? 'maps-geocoding',
  authWebOrigin: expoExtra.authWebOrigin ?? 'https://cayankuzu.github.io/SoRita_web',
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
  hasRequiredStartupConfig: missingRequiredStartupEnvVars.length === 0,
  missingRequiredStartupEnvVars,
};
