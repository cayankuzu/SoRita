import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingAuthRedirectStates,
  consumePendingAuthRedirectState,
  createTrackedAuthRedirect,
  discardPendingAuthRedirectState,
  normalizeAuthRedirectParams,
  parseAuthDeepLinkUrl,
} from '@/mobile/app/app-shell/auth/session/authRedirectState';

vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(),
}));

vi.mock('@/mobile/app/platform/config/env', () => ({
  env: {
    appScheme: 'sorita',
  },
}));

const storageKey = 'sorita.auth.redirect.state';
const nowMs = Date.parse('2026-07-15T10:00:00.000Z');

describe('authRedirectState', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(nowMs);
    vi.mocked(Crypto.randomUUID).mockReset();
  });

  it('creates tracked app redirects and consumes matching state once', async () => {
    vi.mocked(Crypto.randomUUID).mockReturnValue('state-1');

    const entry = await createTrackedAuthRedirect('signup');

    expect(entry).toEqual({
      flow: 'signup',
      target: 'auth/callback',
      state: 'state-1',
      createdAt: nowMs,
      url: 'sorita://auth/callback?flow=signup&state=state-1',
    });

    await expect(
      consumePendingAuthRedirectState({
        flow: 'signup',
        state: 'state-1',
        target: 'auth/callback',
      }),
    ).resolves.toEqual({
      success: true,
      entry: {
        flow: 'signup',
        target: 'auth/callback',
        state: 'state-1',
        createdAt: nowMs,
      },
    });

    await expect(
      consumePendingAuthRedirectState({
        flow: 'signup',
        state: 'state-1',
        target: 'auth/callback',
      }),
    ).resolves.toEqual({
      success: false,
      reason: 'state_not_found',
    });
  });

  it('rejects missing, mismatched, expired, and discarded redirect states', async () => {
    vi.mocked(Crypto.randomUUID).mockReturnValueOnce('reset-state').mockReturnValueOnce('fresh-state');

    await expect(
      consumePendingAuthRedirectState({
        flow: undefined,
        state: 'reset-state',
        target: 'reset-password',
      }),
    ).resolves.toEqual({
      success: false,
      reason: 'missing_state',
    });

    await createTrackedAuthRedirect('password-reset');
    await expect(
      consumePendingAuthRedirectState({
        flow: 'signup',
        state: 'reset-state',
        target: 'reset-password',
      }),
    ).resolves.toEqual({
      success: false,
      reason: 'state_mismatch',
    });

    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        expired: {
          flow: 'signup',
          target: 'auth/callback',
          state: 'expired',
          createdAt: nowMs - 3 * 60 * 60 * 1000,
        },
      }),
    );
    await createTrackedAuthRedirect('signup');

    await expect(
      consumePendingAuthRedirectState({
        flow: 'signup',
        state: 'expired',
        target: 'auth/callback',
      }),
    ).resolves.toEqual({
      success: false,
      reason: 'state_not_found',
    });

    await discardPendingAuthRedirectState('fresh-state');
    await expect(
      consumePendingAuthRedirectState({
        flow: 'signup',
        state: 'fresh-state',
        target: 'auth/callback',
      }),
    ).resolves.toEqual({
      success: false,
      reason: 'state_not_found',
    });

    await discardPendingAuthRedirectState(null);
    await clearPendingAuthRedirectStates();
    await expect(AsyncStorage.getItem(storageKey)).resolves.toBeNull();
  });

  it('recovers from corrupt storage payloads', async () => {
    vi.mocked(Crypto.randomUUID).mockReturnValue('state-1');
    await AsyncStorage.setItem(storageKey, '{not-json');

    await expect(createTrackedAuthRedirect('signup')).resolves.toMatchObject({
      state: 'state-1',
    });

    const rawValue = await AsyncStorage.getItem(storageKey);
    expect(rawValue).toContain('state-1');
    expect(rawValue).not.toContain('not-json');
  });

  it('rejects non-object state stores and leaves unknown discards untouched', async () => {
    vi.mocked(Crypto.randomUUID).mockReturnValue('state-from-array');
    await AsyncStorage.setItem(storageKey, '[]');

    await createTrackedAuthRedirect('signup');
    await expect(
      consumePendingAuthRedirectState({
        flow: 'signup',
        state: 'state-from-array',
        target: 'auth/callback',
      }),
    ).resolves.toMatchObject({ success: true });

    await AsyncStorage.setItem(storageKey, 'null');
    await discardPendingAuthRedirectState('unknown-state');
    await expect(AsyncStorage.getItem(storageKey)).resolves.toBe('null');
  });

  it('parses and normalizes auth deep links defensively', () => {
    expect(parseAuthDeepLinkUrl('not-a-url')).toBeNull();
    expect(parseAuthDeepLinkUrl('https://auth.example.com/auth/callback')).toBeNull();
    expect(parseAuthDeepLinkUrl('sorita://unexpected/path?code=abc')).toBeNull();
    expect(parseAuthDeepLinkUrl('sorita://reset-password/?code=reset-code')).toMatchObject({
      code: 'reset-code',
      target: 'reset-password',
    });
    expect(parseAuthDeepLinkUrl('sorita://auth/callback?#')).toMatchObject({
      target: 'auth/callback',
    });
    expect(parseAuthDeepLinkUrl('sorita://auth/callback?=ignored&%E0%A4%A=value&flag')).toMatchObject({
      target: 'auth/callback',
    });

    expect(
      parseAuthDeepLinkUrl(
        'sorita://auth/callback?code=abc&flow=signup&state=hello+world#access_token=token%201&refresh_token=refresh&type=signup',
      ),
    ).toEqual({
      code: 'abc',
      error: undefined,
      errorCode: undefined,
      flow: 'signup',
      state: 'hello world',
      target: 'auth/callback',
    });

    expect(
      normalizeAuthRedirectParams(
        {
          code: ['code-1'],
          error: 123,
          error_code: 'provider_denied',
          flow: 'password-reset',
          state: ['state-1'],
        },
        'reset-password',
      ),
    ).toEqual({
      code: 'code-1',
      error: undefined,
      errorCode: 'provider_denied',
      flow: 'password-reset',
      state: 'state-1',
      target: 'reset-password',
    });
  });
});
