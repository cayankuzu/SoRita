import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

type ExpoExtraConfig = {
  googleMapsApiKey?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseDeleteUserFunctionName?: string;
  expoProjectId?: string;
  enablePushNotifications?: boolean | string;
  authRedirectPath?: string;
};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExpoExtraConfig;
const authRedirectPath = expoExtra.authRedirectPath ?? 'auth/callback';

export const env = {
  googleMapsApiKey: expoExtra.googleMapsApiKey ?? '',
  supabaseUrl: expoExtra.supabaseUrl ?? '',
  supabasePublishableKey: expoExtra.supabasePublishableKey ?? '',
  supabaseDeleteUserFunctionName: expoExtra.supabaseDeleteUserFunctionName ?? 'delete-user',
  pushNotificationsEnabled:
    expoExtra.enablePushNotifications === true || expoExtra.enablePushNotifications === 'true',
  expoProjectId:
    expoExtra.expoProjectId ??
    Constants.easConfig?.projectId ??
    ((Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? ''),
  authRedirectPath,
  authRedirectUrl: Linking.createURL(authRedirectPath),
};
