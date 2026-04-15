import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from '@/mobile/app/platform/config/env';

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
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
