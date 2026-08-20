import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStatus } from '@/mobile/app/platform/network/useNetworkStatus';
import { useOutboxStatus } from '@/mobile/app/platform/sync/outboxStatus';
import { useReduceMotion } from '@/mobile/app/shared/hooks/useReduceMotion';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

export type NetworkFeedbackState = {
  failedCount: number;
  isOffline: boolean;
  isSyncing: boolean;
  message: string;
  shouldShow: boolean;
};

export function useNetworkFeedbackState(): NetworkFeedbackState {
  const status = useNetworkStatus();
  const isOffline = status === 'offline';
  const outbox = useOutboxStatus();
  const shouldShow = isOffline || outbox.syncing || outbox.failedCount > 0;
  const message = isOffline
    ? outbox.pendingCount > 0
      ? tr.system.offlinePendingChanges(outbox.pendingCount)
      : tr.system.offlineMessage
    : outbox.syncing
      ? tr.system.syncingChanges
      : tr.system.syncFailed(outbox.failedCount);

  return {
    failedCount: outbox.failedCount,
    isOffline,
    isSyncing: outbox.syncing,
    message,
    shouldShow,
  };
}

export function OfflineIndicator({
  feedbackState,
  suppressed = false,
}: {
  feedbackState: NetworkFeedbackState;
  suppressed?: boolean;
}) {
  const state = feedbackState;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-70)).current;
  const shouldShow = state.shouldShow && !suppressed;

  useEffect(() => {
    if (reduceMotion) {
      translateY.stopAnimation();
      translateY.setValue(shouldShow ? 0 : -70);
      setVisible(shouldShow);
      return;
    }

    if (shouldShow) {
      setVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else if (visible) {
      Animated.timing(translateY, {
        toValue: -70,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [reduceMotion, shouldShow, translateY, visible]);

  if (!visible || suppressed) {
    return null;
  }

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLabel={state.message}
      accessibilityLiveRegion="polite"
      style={[styles.container, { paddingTop: insets.top, transform: [{ translateY }] }]}
    >
      <View style={[styles.content, state.isSyncing && !state.isOffline ? styles.syncing : null]}>
        <Text style={styles.text}>{state.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    backgroundColor: colors.warning,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  syncing: {
    backgroundColor: colors.primary,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
