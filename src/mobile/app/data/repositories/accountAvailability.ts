import {
  callJsonEdgeFunction,
  isMissingEdgeFunctionError,
} from '@/mobile/app/platform/api/edgeFunctions';
import { env } from '@/mobile/app/platform/config/env';
import { supabase } from '@/mobile/app/platform/supabase/client';

export type AccountAvailabilityResult = {
  emailAvailable: boolean;
  usernameAvailable: boolean;
};

type AccountAvailabilityRpcRow = {
  email_available?: boolean | null;
  username_available?: boolean | null;
};

export async function checkAccountAvailability(params: {
  email?: string | null;
  username?: string | null;
  excludeUserId?: string | null;
}): Promise<AccountAvailabilityResult> {
  const normalizedEmail = params.email?.trim().toLowerCase() || undefined;
  const normalizedUsername = params.username?.trim().toLowerCase() || undefined;
  const rpcArgs = {
    input_email: normalizedEmail ?? null,
    input_exclude_user_id: params.excludeUserId || null,
    input_username: normalizedUsername ?? null,
  };

  try {
    return await callJsonEdgeFunction<AccountAvailabilityResult>(
      env.supabaseAuthGatewayFunctionName,
      {
        action: 'check-availability',
        email: normalizedEmail,
        excludeUserId: params.excludeUserId || undefined,
        username: normalizedUsername,
      },
    );
  } catch (edgeError) {
    const { data, error } = await supabase.rpc('check_account_availability', rpcArgs);

    if (error) {
      if (!isMissingEdgeFunctionError(edgeError)) {
        throw edgeError;
      }

      throw error;
    }

    const row = (Array.isArray(data) ? data[0] : data) as AccountAvailabilityRpcRow | null;

    return {
      emailAvailable: row?.email_available ?? true,
      usernameAvailable: row?.username_available ?? true,
    };
  }
}
