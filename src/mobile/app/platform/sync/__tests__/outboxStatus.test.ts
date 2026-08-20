import { describe, expect, it } from 'vitest';

import {
  getOutboxStatusSnapshot,
  publishOutboxEntries,
  setActiveOutboxUser,
  setOutboxSyncing,
} from '@/mobile/app/platform/sync/outboxStatus';

describe('outboxStatus', () => {
  it('publishes pending, failed and syncing state for the active account', () => {
    setActiveOutboxUser('user-1');
    publishOutboxEntries('user-1', [
      { state: 'pending' },
      { state: 'failed' },
      { state: 'done' },
    ]);
    setOutboxSyncing('user-1', true);

    expect(getOutboxStatusSnapshot()).toEqual({
      failedCount: 1,
      pendingCount: 2,
      syncing: true,
    });

    setActiveOutboxUser(null);
  });

  it('does not leak another account status into the active account', () => {
    setActiveOutboxUser('user-2');
    publishOutboxEntries('user-1', [{ state: 'failed' }]);

    expect(getOutboxStatusSnapshot()).toEqual({
      failedCount: 0,
      pendingCount: 0,
      syncing: false,
    });

    setActiveOutboxUser(null);
  });
});
