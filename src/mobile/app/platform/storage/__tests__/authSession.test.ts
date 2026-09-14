import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authSessionStorageInternals,
  clearPersistedAuthSession,
  getPersistedAuthSession,
  getPersistedAuthUser,
  savePersistedAuthSession,
  savePersistedAuthUser,
} from '@/mobile/app/platform/storage/authSession';

type StoredAuthEnvelope = {
  access_token: string;
  ownerUserId: string | null;
  refresh_token: string;
  user: { id: string } | null;
};

const createSession = (ownerUserId: string, tokenSuffix: string) =>
  ({
    access_token: `access-${tokenSuffix}`,
    refresh_token: `refresh-${tokenSuffix}`,
    user: { id: ownerUserId },
  }) as Session;

const userA = {
  email: 'a@example.com',
  id: 'user-a',
  name: 'User A',
  username: 'user_a',
};

const userB = {
  email: 'b@example.com',
  id: 'user-b',
  name: 'User B',
  username: 'user_b',
};

function parseEnvelope(rawValue: string | undefined) {
  expect(rawValue).toBeTypeOf('string');
  return JSON.parse(rawValue as string) as StoredAuthEnvelope;
}

function expectCoherentEnvelope(rawValue: string | undefined) {
  const envelope = parseEnvelope(rawValue);
  const expectedOwner = envelope.access_token === 'access-a' ? userA.id : userB.id;

  expect(envelope.ownerUserId).toBe(expectedOwner);
  expect(envelope.user?.id ?? expectedOwner).toBe(expectedOwner);
}

describe('authSession storage', () => {
  beforeEach(() => {
    authSessionStorageInternals.resetMemoryCache();
  });

  it('reuses one secure read across startup user and session lookups', async () => {
    const session = createSession('user-1', '1');

    await savePersistedAuthSession(session);
    await savePersistedAuthUser({
      email: 'user@example.com',
      id: 'user-1',
      name: 'User',
      username: 'user',
    });

    expect(vi.mocked(SecureStore.getItemAsync)).toHaveBeenCalledTimes(1);
    await expect(getPersistedAuthUser()).resolves.toMatchObject({ id: 'user-1' });
    await expect(getPersistedAuthSession()).resolves.toEqual({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    expect(vi.mocked(SecureStore.getItemAsync)).toHaveBeenCalledTimes(1);
  });

  it('invalidates the memory snapshot when the session is cleared', async () => {
    await savePersistedAuthSession(createSession('user-1', '1'));
    await clearPersistedAuthSession();

    await expect(getPersistedAuthSession()).resolves.toBeNull();
  });

  it('drops a cross-owner snapshot when a new session is persisted', async () => {
    const sessionB = createSession(userB.id, 'b');

    await savePersistedAuthSession(createSession(userA.id, 'a'));
    await savePersistedAuthUser(userA);
    await savePersistedAuthSession(sessionB);

    const persistedEnvelope = parseEnvelope(
      vi.mocked(SecureStore.setItemAsync).mock.calls.at(-1)?.[1],
    );
    expect(persistedEnvelope).toMatchObject({
      access_token: sessionB.access_token,
      ownerUserId: userB.id,
      refresh_token: sessionB.refresh_token,
      user: null,
    });

    authSessionStorageInternals.resetMemoryCache();
    await expect(getPersistedAuthSession()).resolves.toEqual({
      access_token: sessionB.access_token,
      refresh_token: sessionB.refresh_token,
    });
    await expect(getPersistedAuthUser()).resolves.toBeNull();
  });

  it('removes an unproven legacy snapshot before exposing it', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({
      access_token: 'access-a',
      refresh_token: 'refresh-a',
      user: userA,
    }));

    await expect(getPersistedAuthUser()).resolves.toBeNull();

    const sanitizedEnvelope = parseEnvelope(
      vi.mocked(SecureStore.setItemAsync).mock.calls.at(-1)?.[1],
    );
    expect(sanitizedEnvelope).toMatchObject({ ownerUserId: null, user: null });
  });

  it('serializes A-to-B writes so every kill-window envelope stays owner coherent', async () => {
    await savePersistedAuthSession(createSession(userA.id, 'a'));
    await savePersistedAuthUser(userA);

    let durableRaw = vi.mocked(SecureStore.setItemAsync).mock.calls.at(-1)?.[1];
    const committedEnvelopes = [durableRaw];
    let releaseFirstWrite!: () => void;
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let shouldBlockWrite = true;

    vi.mocked(SecureStore.getItemAsync).mockImplementation(async () => durableRaw ?? null);
    vi.mocked(SecureStore.setItemAsync).mockClear();
    vi.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => {
      if (shouldBlockWrite) {
        shouldBlockWrite = false;
        await firstWriteGate;
      }

      durableRaw = value;
      committedEnvelopes.push(value);
    });

    const sessionBWrite = savePersistedAuthSession(createSession(userB.id, 'b'));
    await vi.waitFor(() => {
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    const staleUserAWrite = savePersistedAuthUser(userA);
    const userBWrite = savePersistedAuthUser(userB);

    await Promise.resolve();
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expectCoherentEnvelope(durableRaw);

    releaseFirstWrite();
    await Promise.all([sessionBWrite, staleUserAWrite, userBWrite]);

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
    committedEnvelopes.forEach(expectCoherentEnvelope);

    authSessionStorageInternals.resetMemoryCache();
    await expect(getPersistedAuthSession()).resolves.toEqual({
      access_token: 'access-b',
      refresh_token: 'refresh-b',
    });
    await expect(getPersistedAuthUser()).resolves.toEqual(userB);
  });
});
