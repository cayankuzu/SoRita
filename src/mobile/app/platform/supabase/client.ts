import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { env } from '@/mobile/app/platform/config/env';
import {
  deleteSecureStorageItem,
  getSecureStorageItem,
  setSecureStorageItem,
} from '@/mobile/app/platform/storage/secureKeyValueStore';

const FALLBACK_SUPABASE_URL = 'https://placeholder.invalid';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'missing-supabase-publishable-key';
const hasRequiredStartupConfig = env.hasRequiredStartupConfig;
const supabaseUrl = hasRequiredStartupConfig ? env.supabaseUrl : FALLBACK_SUPABASE_URL;
const supabasePublishableKey = hasRequiredStartupConfig
  ? env.supabasePublishableKey
  : FALLBACK_SUPABASE_PUBLISHABLE_KEY;

if (!hasRequiredStartupConfig) {
  console.error(
    `Missing required startup env vars: ${env.missingRequiredStartupEnvVars.join(', ')}. ` +
      'This build was likely produced without the required EAS environment variables.',
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: {
      getItem: getSecureStorageItem,
      removeItem: deleteSecureStorageItem,
      setItem: setSecureStorageItem,
    },
  },
});
