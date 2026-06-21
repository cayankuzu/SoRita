import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceEditorSaveProgressBanner } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorSaveProgressBanner';
import { colors } from '@/mobile/app/shared/theme/tokens';

type ProgressBannerSession = {
  setProgress: (progress: number) => void;
  complete: () => void;
  end: () => void;
};

type AppProgressBannerContextType = {
  progress: number | null;
  beginProgress: () => ProgressBannerSession;
};

const AppProgressBannerContext = createContext<AppProgressBannerContextType | null>(null);

function clampProgress(progress: number) {
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function AppProgressBannerProvider({ children }: { children: React.ReactNode }) {
  const [progressState, setProgressState] = useState<{ sessionId: number; progress: number } | null>(null);
  const nextSessionIdRef = useRef(0);

  const beginProgress = useCallback(() => {
    const sessionId = nextSessionIdRef.current + 1;
    nextSessionIdRef.current = sessionId;

    const updateProgress = (progress: number) => {
      const nextProgress = clampProgress(progress);

      setProgressState((current) =>
        current && current.sessionId === sessionId ? { sessionId, progress: nextProgress } : current,
      );
    };

    const end = () => {
      setProgressState((current) => (current && current.sessionId === sessionId ? null : current));
    };

    setProgressState({ sessionId, progress: 0 });

    return {
      setProgress: updateProgress,
      complete: () => updateProgress(100),
      end,
    };
  }, []);

  const value = useMemo<AppProgressBannerContextType>(
    () => ({
      beginProgress,
      progress: progressState?.progress ?? null,
    }),
    [beginProgress, progressState?.progress],
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
  const { progress } = useAppProgressBanner();
  const insets = useSafeAreaInsets();

  if (progress == null) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.host, { paddingTop: insets.top }]}>
      <View style={styles.bannerWrap}>
        <PlaceEditorSaveProgressBanner progress={progress} />
      </View>
    </View>
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
