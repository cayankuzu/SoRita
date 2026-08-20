import { onlineManager } from '@tanstack/react-query';

import { getCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';
import { isAbortError } from '@/mobile/app/shared/utils/abort';

export function readOperationErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  return undefined;
}

export function shouldQueueOfflineOperation(error?: unknown) {
  if (isAbortError(error)) {
    return false;
  }

  const status = readOperationErrorStatus(error);
  return (
    onlineManager.isOnline() === false ||
    getCurrentConnectionStatus() === 'offline' ||
    error instanceof TypeError ||
    status === 408 ||
    status === 429 ||
    (status != null && status >= 500)
  );
}
