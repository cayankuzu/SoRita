import { createClient } from 'npm:@supabase/supabase-js@2';

import { createModerationReportsHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabasePublishableKey =
  Deno.env.get('SB_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = (
  Deno.env.get('MODERATION_REPORTS_ALLOWED_ORIGINS') ?? ''
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const brevoApiKey = Deno.env.get('BREVO_API_KEY') ?? '';
const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
const reportEmailFrom = Deno.env.get('REPORTS_EMAIL_FROM') ?? '';
const reportEmailTo = Deno.env.get('REPORTS_EMAIL_TO') ?? '';

const handleModerationReportsRequest = createModerationReportsHandler({
  config: {
    allowedOrigins,
    brevoApiKey,
    reportEmailFrom,
    reportEmailTo,
    resendApiKey,
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
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }),
});

Deno.serve(handleModerationReportsRequest);
