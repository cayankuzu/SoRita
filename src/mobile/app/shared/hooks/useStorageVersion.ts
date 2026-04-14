import { useSyncExternalStore } from 'react';

import { storage } from '@/mobile/app/data/repositories/supabaseStorage';

export function useStorageVersion() {
  return useSyncExternalStore(
    storage.subscribe,
    storage.getVersion,
    storage.getVersion,
  );
}
