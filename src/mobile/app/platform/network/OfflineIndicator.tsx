import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useNetworkStatus } from '@/mobile/app/platform/network/useNetworkStatus';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

export function OfflineIndicator() {
  const status = useNetworkStatus();
  const isOffline = status === 'offline';
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    if (isOffline) {
      setVisible(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else if (visible) {
      Animated.timing(translateY, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [isOffline, translateY, visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLabel={tr.system.offlineMessage}
      style={[styles.container, { transform: [{ translateY }] }]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>{tr.system.offlineMessage}</Text>
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
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
