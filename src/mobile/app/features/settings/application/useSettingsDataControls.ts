import React from 'react';
import { Share } from 'react-native';

import {
  hydrateAnalyticsConsent,
  setAnalyticsConsent,
  subscribeToAnalyticsConsent,
} from '@/mobile/app/platform/analytics/analyticsConsent';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';

export function useSettingsDataControls() {
  const [analyticsConsentGranted, setAnalyticsConsentGranted] = React.useState(false);
  const [isSavingAnalyticsConsent, setIsSavingAnalyticsConsent] = React.useState(false);
  const [isExportingPersonalData, setIsExportingPersonalData] = React.useState(false);
  const analyticsSaveInFlight = React.useRef(false);
  const dataExportInFlight = React.useRef(false);

  React.useEffect(() => {
    const unsubscribe = subscribeToAnalyticsConsent(setAnalyticsConsentGranted);
    void hydrateAnalyticsConsent().then(setAnalyticsConsentGranted);
    return unsubscribe;
  }, []);

  const saveAnalyticsConsent = React.useCallback((value: boolean) => {
    if (analyticsSaveInFlight.current) return;

    analyticsSaveInFlight.current = true;
    setIsSavingAnalyticsConsent(true);
    void setAnalyticsConsent(value)
      .then(setAnalyticsConsentGranted)
      .finally(() => {
        analyticsSaveInFlight.current = false;
        setIsSavingAnalyticsConsent(false);
      });
  }, []);

  const exportPersonalData = React.useCallback(() => {
    if (dataExportInFlight.current) return;

    dataExportInFlight.current = true;
    setIsExportingPersonalData(true);
    void import('@/mobile/app/data/repositories/personalData')
      .then(({ requestCurrentUserPersonalDataExport }) => requestCurrentUserPersonalDataExport())
      .then(async ({ data, isTruncated }) => {
        await Share.share({
          message: JSON.stringify(data),
          title: tr.settings.personalDataExport,
        });
        showToast(
          isTruncated
            ? tr.settings.personalDataExportPartial
            : tr.settings.personalDataExportReady,
          isTruncated ? 'info' : 'success',
        );
      })
      .catch((error: unknown) => {
        const code = error && typeof error === 'object' && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
        showToast(
          code === 'export_too_large'
            ? tr.settings.personalDataExportTooLarge
            : tr.settings.personalDataExportFailed,
          'error',
        );
      })
      .finally(() => {
        dataExportInFlight.current = false;
        setIsExportingPersonalData(false);
      });
  }, []);

  return {
    analyticsConsentGranted,
    exportPersonalData,
    isExportingPersonalData,
    isSavingAnalyticsConsent,
    saveAnalyticsConsent,
  };
}
