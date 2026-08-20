import { describe, expect, it } from 'vitest';

import { resolveAppFeedbackPriority } from '@/mobile/app/app-shell/feedback/feedbackPriority';

describe('global feedback priority', () => {
  it.each([
    [{ hasBlockingProgress: true, hasOfflineStatus: true, hasSyncStatus: true, hasToast: true }, 'blocking'],
    [{ hasBlockingProgress: false, hasOfflineStatus: true, hasSyncStatus: true, hasToast: true }, 'offline'],
    [{ hasBlockingProgress: false, hasOfflineStatus: false, hasSyncStatus: true, hasToast: true }, 'sync'],
    [{ hasBlockingProgress: false, hasOfflineStatus: false, hasSyncStatus: false, hasToast: true }, 'toast'],
    [{ hasBlockingProgress: false, hasOfflineStatus: false, hasSyncStatus: false, hasToast: false }, 'none'],
  ] as const)('resolves %s before lower-priority feedback', (state, expected) => {
    expect(resolveAppFeedbackPriority(state)).toBe(expected);
  });
});
