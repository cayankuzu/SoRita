import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import type { User } from '@/mobile/app/data/contracts/entities';
import {
  clearCurrentUserState,
  getActiveOrPersistedSession,
  hydratePersistedAuthState,
  persistAuthSession,
  resolveImmediateAuthUser,
  syncAuthenticatedUser,
} from '@/mobile/app/app-shell/auth/session/authSessionSupport';
import { supabase } from '@/mobile/app/platform/supabase/client';

type UseAuthSessionLifecycleParams = {
  setBooted: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<User | null>>;
};

export function useAuthSessionLifecycle({
  setBooted,
  setUser,
}: UseAuthSessionLifecycleParams) {
  useEffect(() => {
    let mounted = true;

    const setBootedIfMounted = () => {
      if (mounted) {
        setBooted(true);
      }
    };

    const setUserIfMounted = (nextUser: User | null) => {
      if (mounted) {
        setUser(nextUser);
      }
    };

    const syncAuthState = async (authUser: SupabaseAuthUser | null) => {
      try {
        if (!authUser) {
          clearCurrentUserState();
          setUserIfMounted(null);
          return;
        }

        setUserIfMounted(resolveImmediateAuthUser(authUser));
        setBootedIfMounted();

        const nextUser = await syncAuthenticatedUser(authUser);
        if (nextUser) {
          setUserIfMounted(nextUser);
        }
      } catch (error) {
        console.error('Failed to sync auth state', error);
      } finally {
        setBootedIfMounted();
      }
    };

    const bootstrapAuth = async () => {
      const session = await getActiveOrPersistedSession();

      if (session?.user) {
        const hydratedUser = await hydratePersistedAuthState(session.user.id);

        if (hydratedUser) {
          setUserIfMounted(hydratedUser);
          setBootedIfMounted();
        }
      }

      await syncAuthState(session?.user ?? null);
    };

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        await persistAuthSession(session);
        await syncAuthState(session?.user ?? null);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setBooted, setUser]);
}
