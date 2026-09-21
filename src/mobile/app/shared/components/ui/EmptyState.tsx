import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import {
  colors,
  contentWidth,
  fontWeight,
  spacing,
  typography,
} from '@/mobile/app/shared/theme/tokens';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
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
  const hasPrimaryAction = Boolean(actionLabel && onAction);
  const hasSecondaryAction = Boolean(secondaryActionLabel && onSecondaryAction);

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: toneBackgrounds[tone] }]}>{icon}</View>
      <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
      {description ? <AppText style={styles.description}>{description}</AppText> : null}
      {hasPrimaryAction || hasSecondaryAction ? (
        <View style={styles.actions}>
          {actionLabel && onAction ? (
            <PrimaryButton
              title={actionLabel}
              onPress={onAction}
              disabled={actionDisabled}
              loading={actionLoading}
              style={styles.actionButton}
            />
          ) : null}
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
    fontWeight: fontWeight.strong,
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
