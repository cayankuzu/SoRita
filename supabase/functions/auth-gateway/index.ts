import { createClient } from 'npm:@supabase/supabase-js@2';

import { createAuthGatewayHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublishableKey =
  Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = (
  Deno.env.get('AUTH_GATEWAY_ALLOWED_ORIGINS') ??
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedRedirectOrigins = (
  Deno.env.get('AUTH_REDIRECT_ALLOWED_ORIGINS') ??
  'https://cayankuzu.github.io/SoRita_web,http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const handleAuthGatewayRequest = createAuthGatewayHandler({
  config: {
    allowedOrigins,
    allowedRedirectOrigins,
    supabasePublishableKey,
    supabaseServiceRoleKey,
    supabaseUrl,
  },
  createAdminClient: () =>
    createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  createAnonymousAuthClient: () =>
    createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  createAuthenticatedAuthClient: (token) =>
    createClient(supabaseUrl, supabasePublishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
});

Deno.serve(handleAuthGatewayRequest);
