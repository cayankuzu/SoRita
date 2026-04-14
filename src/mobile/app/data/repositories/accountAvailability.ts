import { supabase } from '@/mobile/app/platform/supabase/client';

type AvailabilityRow = {
  email_available: boolean;
  username_available: boolean;
};

export type AccountAvailabilityResult = {
  emailAvailable: boolean;
  usernameAvailable: boolean;
};

export async function checkAccountAvailability(params: {
  email?: string | null;
  username?: string | null;
  excludeUserId?: string | null;
}): Promise<AccountAvailabilityResult> {
  const normalizedEmail = params.email?.trim().toLowerCase() || null;
  const normalizedUsername = params.username?.trim().toLowerCase() || null;

  const { data, error } = await supabase.rpc('check_account_availability', {
    input_email: normalizedEmail,
    input_username: normalizedUsername,
    input_exclude_user_id: params.excludeUserId || null,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as AvailabilityRow | null;

  return {
    emailAvailable: row?.email_available ?? true,
    usernameAvailable: row?.username_available ?? true,
  };
}

