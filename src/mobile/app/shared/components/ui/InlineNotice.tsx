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
  // Quieter choices beside the main action, such as a second setting or dismiss.
  extraActions?: ReadonlyArray<{ key: string; label: string; onPress: () => void }>;
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
    titleColor: colors.warning,
    descriptionColor: colors.textMuted,
    actionColor: colors.warning,
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
  extraActions = [],
  title,
  tone = 'info',
}: InlineNoticeProps) {
  const hasAction = Boolean(actionLabel && onAction);

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
      {hasAction || extraActions.length > 0 ? (
        <View style={styles.actions}>
          {hasAction ? (
            <InstantPressable disableFeedback onPress={onAction} style={styles.actionButton}>
              <AppText style={[styles.actionLabel, { color: palette.actionColor }]}>{actionLabel}</AppText>
            </InstantPressable>
          ) : null}
          {extraActions.map((action) => (
            <InstantPressable
              disableFeedback
              key={action.key}
              onPress={action.onPress}
              style={styles.actionButton}
            >
              <AppText style={[styles.actionLabel, { color: palette.descriptionColor }]}>
                {action.label}
              </AppText>
            </InstantPressable>
          ))}
        </View>
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    marginTop: spacing.xxs,
  },
  actionButton: {
    alignSelf: 'flex-start',
  },
  actionLabel: {
    ...typography.captionText,
    fontWeight: fontWeight.strong,
  },
});
