import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { User } from '@/mobile/app/data/contracts/entities';
import { storage } from '@/mobile/app/data/repositories/supabaseStorage';

type UseAuthStorageBridgeParams = {
  setUser: Dispatch<SetStateAction<User | null>>;
};

export function useAuthStorageBridge({ setUser }: UseAuthStorageBridgeParams) {
  useEffect(() => {
    const unsubscribe = storage.subscribe(() => {
      setUser((current) => {
        if (!current) {
          return current;
        }

        return storage.findUserByIdIncludingBlocked(current.id) || current;
      });
    });

    return unsubscribe;
  }, [setUser]);
}
