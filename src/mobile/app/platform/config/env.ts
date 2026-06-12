import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

type ExpoExtraConfig = {
  googleMapsApiKey?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseDeleteUserFunctionName?: string;
  supabaseMediaAssetsFunctionName?: string;
  authWebOrigin?: string;
  expoProjectId?: string;
  enablePushNotifications?: boolean | string;
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

export const env = {
  googleMapsApiKey: expoExtra.googleMapsApiKey ?? '',
  supabaseUrl: expoExtra.supabaseUrl ?? '',
  supabasePublishableKey: expoExtra.supabasePublishableKey ?? '',
  supabaseDeleteUserFunctionName: expoExtra.supabaseDeleteUserFunctionName ?? 'delete-user',
  supabaseMediaAssetsFunctionName: expoExtra.supabaseMediaAssetsFunctionName ?? 'media-assets',
  authWebOrigin: expoExtra.authWebOrigin ?? 'https://cayankuzu.github.io/SoRita_web',
  pushNotificationsEnabledOverride,
  expoProjectId:
    expoExtra.expoProjectId ??
    Constants.easConfig?.projectId ??
    ((Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? ''),
  authRedirectPath,
  authRedirectUrl: Linking.createURL(authRedirectPath),
  sentryDsn: expoExtra.sentryDsn ?? '',
  hasRequiredStartupConfig: missingRequiredStartupEnvVars.length === 0,
  missingRequiredStartupEnvVars,
};
