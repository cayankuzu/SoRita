import { supabase } from '@/mobile/app/platform/supabase/client';

type AvailabilityRow = {
  email_available: boolean;
  username_available: boolean;
};

export type AccountAvailabilityResult = {
  emailAvailable: boolean;
  usernameAvailable: boolean;
};

const AVAILABILITY_TIMEOUT_MS = 3200;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = AVAILABILITY_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Availability check timed out'));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function isProfileValueAvailable(
  column: 'email' | 'username',
  value: string | null,
  excludeUserId?: string | null,
) {
  if (!value) {
    return true;
  }

  let query = supabase.from('profiles').select('id').eq(column, value).limit(1);

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { data, error } = await withTimeout(query.maybeSingle());

  if (error) {
    throw error;
  }

  return !data;
}

async function checkAccountAvailabilityFromProfiles(params: {
  normalizedEmail: string | null;
  normalizedUsername: string | null;
  excludeUserId?: string | null;
}): Promise<AccountAvailabilityResult> {
  const [emailAvailable, usernameAvailable] = await Promise.all([
    isProfileValueAvailable('email', params.normalizedEmail, params.excludeUserId),
    isProfileValueAvailable('username', params.normalizedUsername, params.excludeUserId),
  ]);

  return {
    emailAvailable,
    usernameAvailable,
  };
}

export async function checkAccountAvailability(params: {
  email?: string | null;
  username?: string | null;
  excludeUserId?: string | null;
}): Promise<AccountAvailabilityResult> {
  const normalizedEmail = params.email?.trim().toLowerCase() || null;
  const normalizedUsername = params.username?.trim().toLowerCase() || null;

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('check_account_availability', {
        input_email: normalizedEmail,
        input_username: normalizedUsername,
        input_exclude_user_id: params.excludeUserId || null,
      }),
    );

    if (error) {
      throw error;
    }

    const row = (Array.isArray(data) ? data[0] : data) as AvailabilityRow | null;

    return {
      emailAvailable: row?.email_available ?? true,
      usernameAvailable: row?.username_available ?? true,
    };
  } catch {
    return checkAccountAvailabilityFromProfiles({
      normalizedEmail,
      normalizedUsername,
      excludeUserId: params.excludeUserId,
    });
  }
}
