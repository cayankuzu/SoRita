import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env } from '@/mobile/app/platform/config/env';

const supabaseUrl = env.supabaseUrl;
const supabasePublishableKey = env.supabasePublishableKey;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('Supabase env variables are missing. Auth and database features will stay unavailable.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

