import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { colors, contentWidth, spacing, typography } from '@/mobile/app/shared/theme/tokens';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void | Promise<void>;
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
  onSecondaryAction,
  secondaryActionLabel,
  title,
  tone = 'default',
}: EmptyStateProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: toneBackgrounds[tone] }]}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.actions}>
          <PrimaryButton
            title={actionLabel}
            onPress={onAction}
            disabled={actionDisabled}
            loading={actionLoading}
            style={styles.actionButton}
          />
          {secondaryActionLabel && onSecondaryAction ? (
            <PrimaryButton
              title={secondaryActionLabel}
              onPress={onSecondaryAction}
              variant="ghost"
              style={styles.actionButton}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 38,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    maxWidth: contentWidth.form,
    width: '100%',
    alignSelf: 'center',
  },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    ...typography.section,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    ...typography.bodyText,
    color: colors.textMuted,
    textAlign: 'center',
  },
  actionButton: {
    minWidth: 138,
  },
  actions: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
});
