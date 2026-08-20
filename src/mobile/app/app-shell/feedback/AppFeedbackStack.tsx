import React from 'react';

import {
  AppProgressBannerHost,
  useAppProgressBanner,
} from '@/mobile/app/app-shell/feedback/AppProgressBanner';
import { resolveAppFeedbackPriority } from '@/mobile/app/app-shell/feedback/feedbackPriority';
import { ToastHost } from '@/mobile/app/platform/feedback/ToastHost';
import {
  OfflineIndicator,
  useNetworkFeedbackState,
} from '@/mobile/app/platform/network/OfflineIndicator';

export function AppFeedbackStack() {
  const { banner } = useAppProgressBanner();
  const networkFeedback = useNetworkFeedbackState();
  const priority = resolveAppFeedbackPriority({
    hasBlockingProgress: Boolean(banner),
    hasOfflineStatus: networkFeedback.isOffline,
    hasSyncStatus: !networkFeedback.isOffline && networkFeedback.shouldShow,
    // ToastHost owns its short-lived queue; this value means it may occupy the slot.
    hasToast: true,
  });
  const networkHasPriority = priority === 'offline' || priority === 'sync';

  return (
    <>
      <AppProgressBannerHost />
      <OfflineIndicator
        feedbackState={networkFeedback}
        suppressed={!networkHasPriority}
      />
      <ToastHost suppressed={priority !== 'toast'} />
    </>
  );
}
