import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { colors } from '@/mobile/app/shared/theme/tokens';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  tone?: 'default' | 'info' | 'warning' | 'danger';
};

const toneBackgrounds = {
  default: colors.surfaceMuted,
  info: colors.primaryBg,
  warning: colors.warningBg,
  danger: colors.dangerBg,
};

export function EmptyState({
  actionDisabled = false,
  actionLabel,
  actionLoading = false,
  description,
  icon,
  onAction,
  title,
  tone = 'default',
}: EmptyStateProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: toneBackgrounds[tone] }]}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          disabled={actionDisabled}
          loading={actionLoading}
          style={styles.actionButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actionButton: {
    minWidth: 160,
    marginTop: 8,
  },
});
