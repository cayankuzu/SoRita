import { getPersistedAuthUser } from '@/mobile/app/platform/storage/authSession';

let primeInFlight: Promise<number> | null = null;

/**
 * Starts secure-session and cold-cache reads before React mounts. The auth
 * lifecycle reuses the same in-memory session read, so this creates overlap
 * without duplicating native storage I/O.
 */
export function primePersistedStartupData() {
  if (primeInFlight) {
    return primeInFlight;
  }

  primeInFlight = (async () => {
    const user = await getPersistedAuthUser();

    if (!user?.id) {
      return 0;
    }

    const [{ restoreStartupQueryCache }, { queryClient }] = await Promise.all([
      import('@/mobile/app/data/cache/startupQueryCache'),
      import('@/mobile/app/data/query/queryClient'),
    ]);

    return restoreStartupQueryCache(queryClient, user.id);
  })().catch(() => 0);

  return primeInFlight;
}

export const primePersistedStartupDataInternals = {
  reset() {
    primeInFlight = null;
  },
};
