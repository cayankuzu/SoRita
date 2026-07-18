import { createClient } from 'npm:@supabase/supabase-js@2';

import { createMapsGeocodingHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublishableKey =
  Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const googleMapsServicesApiKey = Deno.env.get('GOOGLE_MAPS_SERVICES_API_KEY') ?? '';
const allowedOrigins = (
  Deno.env.get('MAPS_GEOCODING_ALLOWED_ORIGINS') ??
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3000'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const handleMapsGeocodingRequest = createMapsGeocodingHandler({
  config: {
    allowedOrigins,
    googleMapsServicesApiKey,
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
  createAuthClient: (token) =>
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

Deno.serve(handleMapsGeocodingRequest);
