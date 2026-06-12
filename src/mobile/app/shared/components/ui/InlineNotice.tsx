import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
    borderColor: '#bfdbfe',
    titleColor: colors.text,
    descriptionColor: colors.textMuted,
    actionColor: colors.primaryDark,
  },
  warning: {
    backgroundColor: colors.warningBg,
    borderColor: '#fde68a',
    titleColor: colors.warningText,
    descriptionColor: colors.textMuted,
    actionColor: colors.warningText,
  },
  danger: {
    backgroundColor: colors.dangerBg,
    borderColor: '#fecaca',
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
      accessibilityRole="alert"
      style={[
        styles.container,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Text style={[styles.title, { color: palette.titleColor }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: palette.descriptionColor }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <InstantPressable disableFeedback onPress={onAction} style={styles.actionButton}>
          <Text style={[styles.actionLabel, { color: palette.actionColor }]}>{actionLabel}</Text>
        </InstantPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
  },
  actionButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
