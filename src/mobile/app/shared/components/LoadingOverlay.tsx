import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type Props = {
  message?: string;
  visible: boolean;
};

/**
 * Modal loading overlay for blocking operations (save, delete, upload).
 * Prevents double-taps and shows progress feedback.
 */
export function LoadingOverlay({ message, visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 28,
    alignItems: 'center',
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  message: {
    marginTop: 14,
    fontSize: typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
