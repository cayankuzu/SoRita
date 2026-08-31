import { supabase } from '@/mobile/app/platform/supabase/client';

type RefreshSessionResult = Awaited<ReturnType<typeof supabase.auth.refreshSession>>;

let refreshInFlight: Promise<RefreshSessionResult> | null = null;

/**
 * Supabase refresh tokens are single-use. Keep every caller in the process on
 * one refresh request so lifecycle revalidation and API retries cannot race.
 */
export function refreshSupabaseSession() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refresh = Promise.resolve().then(() => supabase.auth.refreshSession());
  const trackedRefresh = refresh.finally(() => {
    if (refreshInFlight === trackedRefresh) {
      refreshInFlight = null;
    }
  });

  refreshInFlight = trackedRefresh;
  return trackedRefresh;
}
