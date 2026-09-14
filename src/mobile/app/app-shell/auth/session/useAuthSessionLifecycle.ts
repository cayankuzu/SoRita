import { useEffect } from 'react';

import {
  startAuthSessionLifecycle,
  type AuthSessionLifecycleParams,
} from '@/mobile/app/app-shell/auth/session/authSessionLifecycleRuntime';

export function useAuthSessionLifecycle({ setBooted, setUser }: AuthSessionLifecycleParams) {
  useEffect(
    () => startAuthSessionLifecycle({ setBooted, setUser }),
    [setBooted, setUser],
  );
}
