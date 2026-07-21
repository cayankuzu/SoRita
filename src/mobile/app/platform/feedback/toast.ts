import { Platform, ToastAndroid } from 'react-native';

import { logger } from '@/mobile/app/platform/feedback/logger';

export type ToastKind = 'success' | 'error' | 'info';
export type AppToast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastListener = (toast: AppToast) => void;
const DUPLICATE_TOAST_WINDOW_MS = 1_500;
let lastToast: { key: string; shownAt: number } | null = null;
let nextToastId = 0;
let pendingToast: AppToast | null = null;
const listeners = new Set<ToastListener>();

export function subscribeToToasts(listener: ToastListener) {
  listeners.add(listener);
  if (pendingToast) {
    listener(pendingToast);
    pendingToast = null;
  }

  return () => {
    listeners.delete(listener);
  };
}

export function showToast(message: string, kind: ToastKind = 'info') {
  const now = Date.now();
  const key = `${kind}:${message}`;

  if (lastToast?.key === key && now - lastToast.shownAt < DUPLICATE_TOAST_WINDOW_MS) {
    return;
  }

  lastToast = { key, shownAt: now };
  if (kind === 'error') {
    logger.error('toast', message);
  } else if (kind === 'success') {
    logger.info('toast', message);
  } else {
    logger.debug('toast', message);
  }

  const toast = { id: ++nextToastId, kind, message } satisfies AppToast;
  if (listeners.size > 0) {
    listeners.forEach((listener) => listener(toast));
    return;
  }

  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  // iOS'ta bloklayan sistem uyarısı yerine host bağlanır bağlanmaz gösterilir.
  pendingToast = toast;
}

export const toastInternals = {
  DUPLICATE_TOAST_WINDOW_MS,
  reset() {
    lastToast = null;
    pendingToast = null;
    nextToastId = 0;
  },
  listenerCount: () => listeners.size,
};
