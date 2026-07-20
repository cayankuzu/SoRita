import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authSessionStorageInternals,
  clearPersistedAuthSession,
  getPersistedAuthSession,
  getPersistedAuthUser,
  savePersistedAuthSession,
  savePersistedAuthUser,
} from '@/mobile/app/platform/storage/authSession';

const session = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
};

describe('authSession storage', () => {
  beforeEach(() => {
    authSessionStorageInternals.resetMemoryCache();
  });

  it('reuses one secure read across startup user and session lookups', async () => {
    await savePersistedAuthSession(session as never);
    await savePersistedAuthUser({
      email: 'user@example.com',
      id: 'user-1',
      name: 'User',
      username: 'user',
    });

    expect(vi.mocked(SecureStore.getItemAsync)).toHaveBeenCalledTimes(1);
    await expect(getPersistedAuthUser()).resolves.toMatchObject({ id: 'user-1' });
    await expect(getPersistedAuthSession()).resolves.toEqual(session);
    expect(vi.mocked(SecureStore.getItemAsync)).toHaveBeenCalledTimes(1);
  });

  it('invalidates the memory snapshot when the session is cleared', async () => {
    await savePersistedAuthSession(session as never);
    await clearPersistedAuthSession();

    await expect(getPersistedAuthSession()).resolves.toBeNull();
  });
});
