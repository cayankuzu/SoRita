import { createClient } from 'npm:@supabase/supabase-js@2';

import { createPersonalDataHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublishableKey = Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = (Deno.env.get('PERSONAL_DATA_ALLOWED_ORIGINS') ?? '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

Deno.serve(createPersonalDataHandler({
  config: { allowedOrigins, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl },
  createAdminClient: () => createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }),
  createAuthClient: (token) => createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  }),
}));
