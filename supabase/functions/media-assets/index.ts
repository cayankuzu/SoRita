import { createClient } from 'npm:@supabase/supabase-js@2';

import { createMediaAssetsHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublishableKey =
  Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = (
  Deno.env.get('MEDIA_ASSETS_ALLOWED_ORIGINS') ?? ''
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const handleMediaAssetsRequest = createMediaAssetsHandler({
  config: {
    allowedOrigins,
    supabasePublishableKey,
    supabaseServiceRoleKey,
    supabaseUrl,
  },
  createAdminClient: () =>
    createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
  createAuthClient: (token) =>
    createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }),
});

Deno.serve(handleMediaAssetsRequest);
