export type AppFeedbackPriority = 'blocking' | 'offline' | 'sync' | 'toast' | 'none';

export function resolveAppFeedbackPriority(params: {
  hasBlockingProgress: boolean;
  hasOfflineStatus: boolean;
  hasSyncStatus: boolean;
  hasToast: boolean;
}): AppFeedbackPriority {
  if (params.hasBlockingProgress) {
    return 'blocking';
  }

  if (params.hasOfflineStatus) {
    return 'offline';
  }

  if (params.hasSyncStatus) {
    return 'sync';
  }

  if (params.hasToast) {
    return 'toast';
  }

  return 'none';
}
