import { useCallback, useRef, useState } from 'react';

import { showToast } from '@/mobile/app/platform/feedback/toast';

export type ReportState = 'idle' | 'selecting' | 'submitting' | 'done';

export type UseReportFlowOptions = {
  duplicateMessage: string;
  failedMessage: string;
  mutationFn: (reason: string) => Promise<unknown>;
  successMessage: string;
};

/**
 * Shared hook for report flows (users, places, comments, lists).
 * Eliminates repeated report state management across features.
 */
export function useReportFlow({
  duplicateMessage,
  failedMessage,
  mutationFn,
  successMessage,
}: UseReportFlowOptions) {
  const [state, setState] = useState<ReportState>('idle');
  const hasReportedRef = useRef(false);

  const startReport = useCallback(() => {
    if (hasReportedRef.current) {
      showToast(duplicateMessage, 'info');
      return;
    }
    setState('selecting');
  }, [duplicateMessage]);

  const cancelReport = useCallback(() => {
    setState('idle');
  }, []);

  const submitReport = useCallback(
    async (reason: string) => {
      if (hasReportedRef.current) {
        showToast(duplicateMessage, 'info');
        return;
      }

      setState('submitting');
      try {
        await mutationFn(reason);
        hasReportedRef.current = true;
        setState('done');
        showToast(successMessage, 'success');
      } catch {
        setState('idle');
        showToast(failedMessage, 'error');
      }
    },
    [duplicateMessage, failedMessage, mutationFn, successMessage],
  );

  return {
    cancelReport,
    hasReported: hasReportedRef.current,
    startReport,
    state,
    submitReport,
  };
}
