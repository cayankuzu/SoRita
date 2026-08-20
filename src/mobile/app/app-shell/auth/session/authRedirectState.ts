import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { env } from '@/mobile/app/platform/config/env';

export type AuthRedirectFlow = 'signup' | 'password-reset';
export type AuthRedirectTarget = 'auth/callback' | 'reset-password';

export type PendingAuthRedirectState = {
  flow: AuthRedirectFlow;
  target: AuthRedirectTarget;
  state: string;
  createdAt: number;
};

export type AuthRedirectParams = {
  code?: string;
  error?: string;
  errorCode?: string;
  flow?: string;
  state?: string;
  target: AuthRedirectTarget;
};

const AUTH_REDIRECT_STATE_STORAGE_KEY = 'sorita.auth.redirect.state';
const AUTH_REDIRECT_STATE_TTL_MS = 2 * 60 * 60 * 1000;
const AUTH_TARGETS: Record<AuthRedirectFlow, AuthRedirectTarget> = {
  signup: 'auth/callback',
  'password-reset': 'reset-password',
};

type PendingAuthRedirectStateStore = Record<string, PendingAuthRedirectState>;
type RouteParams = Record<string, unknown> | undefined | null;

function now() {
  return Date.now();
}

function getStringParam(value: unknown) {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

function generateRandomUuid() {
  return Crypto.randomUUID();
}

async function readStore(): Promise<PendingAuthRedirectStateStore> {
  const rawValue = await AsyncStorage.getItem(AUTH_REDIRECT_STATE_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as PendingAuthRedirectStateStore;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    await AsyncStorage.removeItem(AUTH_REDIRECT_STATE_STORAGE_KEY);
    return {};
  }
}

async function writeStore(store: PendingAuthRedirectStateStore) {
  const entries = Object.entries(store);

  if (entries.length === 0) {
    await AsyncStorage.removeItem(AUTH_REDIRECT_STATE_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(AUTH_REDIRECT_STATE_STORAGE_KEY, JSON.stringify(store));
}

function pruneExpiredStates(store: PendingAuthRedirectStateStore) {
  const timestamp = now();
  return Object.fromEntries(
    Object.entries(store).filter(([, item]) => timestamp - item.createdAt <= AUTH_REDIRECT_STATE_TTL_MS),
  ) as PendingAuthRedirectStateStore;
}

function buildTrackedAppUrl(entry: PendingAuthRedirectState) {
  const params = new URLSearchParams({
    flow: entry.flow,
    state: entry.state,
  });

  return `${env.appScheme}://${entry.target}?${params.toString()}`;
}

export async function createTrackedAuthRedirect(flow: AuthRedirectFlow) {
  const state = generateRandomUuid();
  const entry: PendingAuthRedirectState = {
    flow,
    target: AUTH_TARGETS[flow],
    state,
    createdAt: now(),
  };
  const store = pruneExpiredStates(await readStore());
  store[state] = entry;
  await writeStore(store);

  return {
    ...entry,
    url: buildTrackedAppUrl(entry),
  };
}

export async function discardPendingAuthRedirectState(state?: string | null) {
  if (!state) {
    return;
  }

  const store = await readStore();
  if (!store[state]) {
    return;
  }

  delete store[state];
  await writeStore(pruneExpiredStates(store));
}

export async function clearPendingAuthRedirectStates() {
  await AsyncStorage.removeItem(AUTH_REDIRECT_STATE_STORAGE_KEY);
}

export async function consumePendingAuthRedirectState(params: {
  flow?: string;
  state?: string;
  target: AuthRedirectTarget;
}) {
  const { flow, state, target } = params;

  if (!flow || !state) {
    return { success: false as const, reason: 'missing_state' };
  }

  const store = pruneExpiredStates(await readStore());
  const entry = store[state];

  if (!entry) {
    await writeStore(store);
    return { success: false as const, reason: 'state_not_found' };
  }

  if (entry.flow !== flow || entry.target !== target) {
    delete store[state];
    await writeStore(store);
    return { success: false as const, reason: 'state_mismatch' };
  }

  delete store[state];
  await writeStore(store);
  return { success: true as const, entry };
}

function decodeParamComponent(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return '';
  }
}

function parseParamString(value: string) {
  const params: Record<string, string> = {};
  const cleanValue = value.replace(/^[?#]/, '');

  if (!cleanValue) {
    return params;
  }

  for (const pair of cleanValue.split('&')) {
    const separatorIndex = pair.indexOf('=');
    const rawKey = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;
    const rawValue = separatorIndex >= 0 ? pair.slice(separatorIndex + 1) : '';
    if (!rawKey) {
      continue;
    }

    const key = decodeParamComponent(rawKey);
    if (!key) {
      continue;
    }

    params[key] = decodeParamComponent(rawValue);
  }

  return params;
}

export function parseAuthDeepLinkUrl(url: string): AuthRedirectParams | null {
  const match = url.match(/^([^:]+):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/);

  if (!match || match[1] !== env.appScheme) {
    return null;
  }

  const host = match[2] ?? '';
  const path = (match[3] ?? '').replace(/^\/+/, '').replace(/\/+$/, '');
  const target = [host, path].filter(Boolean).join('/') as AuthRedirectTarget;

  if (target !== 'auth/callback' && target !== 'reset-password') {
    return null;
  }

  return normalizeAuthRedirectParams(
    {
      ...parseParamString(match[4] ?? ''),
      ...parseParamString(match[5] ?? ''),
    },
    target,
  );
}

export function normalizeAuthRedirectParams(params: RouteParams, target: AuthRedirectTarget): AuthRedirectParams {
  return {
    code: getStringParam(params?.code),
    error: getStringParam(params?.error),
    errorCode: getStringParam(params?.error_code),
    flow: getStringParam(params?.flow),
    state: getStringParam(params?.state),
    target,
  };
}
