import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, fontWeight, radius, spacing, typography } from '@/mobile/app/shared/theme/tokens';

type InlineNoticeProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'info' | 'warning' | 'danger';
};

const tonePalettes = {
  info: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.infoBorder,
    titleColor: colors.text,
    descriptionColor: colors.textMuted,
    actionColor: colors.primaryDark,
  },
  warning: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    titleColor: colors.warningText,
    descriptionColor: colors.textMuted,
    actionColor: colors.warningText,
  },
  danger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    titleColor: colors.danger,
    descriptionColor: colors.textMuted,
    actionColor: colors.danger,
  },
};

export function InlineNotice({
  actionLabel,
  description,
  onAction,
  title,
  tone = 'info',
}: InlineNoticeProps) {
  const palette = tonePalettes[tone];

  return (
    <View
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      style={[
        styles.container,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <AppText
        accessibilityRole={tone === 'danger' ? 'alert' : undefined}
        style={[styles.title, { color: palette.titleColor }]}
      >
        {title}
      </AppText>
      {description ? (
        <AppText style={[styles.description, { color: palette.descriptionColor }]}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <InstantPressable disableFeedback onPress={onAction} style={styles.actionButton}>
          <AppText style={[styles.actionLabel, { color: palette.actionColor }]}>{actionLabel}</AppText>
        </InstantPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.captionText,
    fontWeight: fontWeight.strong,
  },
  description: {
    ...typography.captionText,
  },
  actionButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
  },
  actionLabel: {
    ...typography.captionText,
    fontWeight: fontWeight.strong,
  },
});
