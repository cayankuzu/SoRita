import { callJsonEdgeFunction } from '@/mobile/app/platform/api/edgeFunctions';
import { env } from '@/mobile/app/platform/config/env';
import { supabase } from '@/mobile/app/platform/supabase/client';

export type AccountAvailabilityResult = {
  emailAvailable: boolean;
  usernameAvailable: boolean;
};

export async function checkAccountAvailability(params: {
  email?: string | null;
  username?: string | null;
  excludeUserId?: string | null;
}): Promise<AccountAvailabilityResult> {
  const normalizedEmail = params.email?.trim().toLowerCase() || undefined;
  const normalizedUsername = params.username?.trim().toLowerCase() || undefined;
  let accessToken: string | undefined;

  if (params.excludeUserId) {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session?.access_token) {
      throw error ?? new Error('Authenticated account availability check requires a session.');
    }

    accessToken = data.session.access_token;
  }

  const payload = {
    action: 'check-availability',
    email: normalizedEmail,
    excludeUserId: params.excludeUserId || undefined,
    username: normalizedUsername,
  } as const;

  return accessToken
    ? callJsonEdgeFunction<AccountAvailabilityResult>(
        env.supabaseAuthGatewayFunctionName,
        payload,
        { accessToken },
      )
    : callJsonEdgeFunction<AccountAvailabilityResult>(
        env.supabaseAuthGatewayFunctionName,
        payload,
      );
}
