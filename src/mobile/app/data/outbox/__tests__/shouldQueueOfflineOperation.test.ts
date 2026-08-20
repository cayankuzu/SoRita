import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import {
  readOperationErrorStatus,
  shouldQueueOfflineOperation,
} from '@/mobile/app/data/outbox/shouldQueueOfflineOperation';
import { setCurrentConnectionStatus } from '@/mobile/app/platform/network/connectivityStatus';

describe('shouldQueueOfflineOperation', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    setCurrentConnectionStatus('online');
  });

  it('queues transport, offline, throttled, and server failures', () => {
    expect(shouldQueueOfflineOperation(new TypeError('transport'))).toBe(true);
    expect(shouldQueueOfflineOperation({ status: 408 })).toBe(true);
    expect(shouldQueueOfflineOperation({ status: 429 })).toBe(true);
    expect(shouldQueueOfflineOperation({ statusCode: 503 })).toBe(true);

    onlineManager.setOnline(false);
    expect(shouldQueueOfflineOperation(new Error('offline'))).toBe(true);
  });

  it('does not queue validation or intentional abort failures', () => {
    const abortError = new Error('cancelled');
    abortError.name = 'AbortError';

    expect(shouldQueueOfflineOperation(abortError)).toBe(false);
    expect(shouldQueueOfflineOperation({ status: 400 })).toBe(false);
    expect(readOperationErrorStatus({ statusCode: 502 })).toBe(502);
    expect(readOperationErrorStatus(null)).toBeUndefined();
  });
});
