import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceEditorSaveProgressBanner } from '@/mobile/app/features/map/public/feedback';
import {
  ActionMenuSheet,
  type ActionMenuSheetItem,
} from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type ProgressBannerSession = {
  setProgress: (progress: number) => void;
  complete: () => void;
  fail: (options?: ProgressBannerFailureOptions) => void;
  end: () => void;
};

type ProgressBannerFailureOptions = {
  onCancel?: () => void;
  onOpen?: () => void;
  onRetry?: () => void;
};

type ProgressBannerState = {
  onCancel?: () => void;
  onOpen?: () => void;
  onRetry?: () => void;
  progress: number;
  sessionId: number;
  status: 'active' | 'failed';
};

type AppProgressBannerContextType = {
  banner: ProgressBannerState | null;
  beginProgress: (options?: {
    onCancel?: () => void;
    onOpen?: () => void;
  }) => ProgressBannerSession;
  dismissBanner: () => void;
};

const AppProgressBannerContext = createContext<AppProgressBannerContextType | null>(null);
const CANCEL_PROGRESS_CONFIRMATION = {
  description: tr.system.uploadCancelDescription,
  title: tr.system.uploadCancelTitle,
} as const;

function clampProgress(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function AppProgressBannerProvider({ children }: { children: React.ReactNode }) {
  const [progressState, setProgressState] = useState<ProgressBannerState | null>(null);
  const nextSessionIdRef = useRef(0);

  const dismissBanner = useCallback(() => {
    setProgressState(null);
  }, []);

  const beginProgress = useCallback((options?: { onCancel?: () => void; onOpen?: () => void }) => {
    const sessionId = nextSessionIdRef.current + 1;
    nextSessionIdRef.current = sessionId;

    const updateProgress = (progress: number) => {
      const nextProgress = clampProgress(progress);

      setProgressState((current) =>
        current && current.sessionId === sessionId
          ? { ...current, progress: nextProgress }
          : current,
      );
    };

    const end = () => {
      setProgressState((current) =>
        current && current.sessionId === sessionId && current.status === 'active' ? null : current,
      );
    };

    setProgressState({
      onCancel: options?.onCancel,
      onOpen: options?.onOpen,
      progress: 0,
      sessionId,
      status: 'active',
    });

    return {
      setProgress: updateProgress,
      complete: () => updateProgress(100),
      fail: (failureOptions?: ProgressBannerFailureOptions) => {
        setProgressState((current) =>
          current && current.sessionId === sessionId
            ? {
                ...current,
                onCancel: failureOptions?.onCancel ?? current.onCancel,
                onOpen: failureOptions?.onOpen ?? current.onOpen,
                onRetry: failureOptions?.onRetry,
                status: 'failed',
              }
            : current,
        );
      },
      end,
    };
  }, []);

  const value = useMemo<AppProgressBannerContextType>(
    () => ({
      beginProgress,
      banner: progressState,
      dismissBanner,
    }),
    [beginProgress, dismissBanner, progressState],
  );

  return <AppProgressBannerContext.Provider value={value}>{children}</AppProgressBannerContext.Provider>;
}

export function useAppProgressBanner() {
  const context = useContext(AppProgressBannerContext);

  if (!context) {
    throw new Error('useAppProgressBanner must be used inside AppProgressBannerProvider');
  }

  return context;
}

export function AppProgressBannerHost() {
  const { banner, dismissBanner } = useAppProgressBanner();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (!banner) {
      setMenuVisible(false);
      setShowCancelConfirm(false);
    }
  }, [banner]);

  const menuItems = useMemo<readonly ActionMenuSheetItem[]>(() => {
    if (!banner) {
      return [];
    }

    const items: ActionMenuSheetItem[] = [];

    if (banner.onOpen) {
      items.push({
        key: 'open',
        label: tr.common.goToPost,
        onPress: () => {
          setMenuVisible(false);
          banner.onOpen?.();
        },
      });
    }

    if (banner.onCancel) {
      items.push({
        key: 'cancel',
        label: tr.common.cancel,
        onPress: () => {
          setMenuVisible(false);
          setShowCancelConfirm(true);
        },
        tone: 'danger',
      });
    }

    if (banner.status === 'failed' && banner.onRetry) {
      items.push({
        key: 'retry',
        label: tr.common.retry,
        onPress: () => {
          setMenuVisible(false);
          dismissBanner();
          banner.onRetry?.();
        },
      });
    }

    return items;
  }, [banner, dismissBanner]);

  if (!banner) {
    return null;
  }

  return (
    <>
      <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top }]}>
        <View style={styles.bannerWrap}>
          <PlaceEditorSaveProgressBanner
            progress={banner.progress}
            status={banner.status}
            onMenuPress={menuItems.length > 0 ? () => setMenuVisible(true) : undefined}
          />
        </View>
      </View>
      {menuItems.length > 0 && menuVisible ? (
        <ActionMenuSheet
          visible
          title={banner.status === 'failed' ? tr.placeEditor.saveFailedTitle : tr.placeEditor.saveProgressTitle}
          items={menuItems}
          onClose={() => setMenuVisible(false)}
        />
      ) : null}
      {banner && showCancelConfirm ? (
        <ConfirmActionModal
          visible
          title={CANCEL_PROGRESS_CONFIRMATION.title}
          description={CANCEL_PROGRESS_CONFIRMATION.description}
          confirmLabel={tr.common.cancel}
          confirmVariant="danger"
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={() => {
            setShowCancelConfirm(false);
            dismissBanner();
            banner.onCancel?.();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    backgroundColor: colors.background,
  },
  bannerWrap: {
    width: '100%',
  },
});
