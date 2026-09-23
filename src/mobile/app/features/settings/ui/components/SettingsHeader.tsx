import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, minTouchSize, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

type SettingsHeaderProps = {
  title: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export function SettingsHeader({
  title,
  onBack,
  actionLabel,
  onAction,
}: SettingsHeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel={tr.common.back} onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={iconSize.md} />
      </IconButton>
      <AppText accessibilityRole="header" style={styles.headerTitle}>{title}</AppText>
      {actionLabel && onAction ? (
        <InstantPressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          style={styles.headerAction}
          onPress={onAction}
        >
          <AppText style={styles.headerActionText}>{actionLabel}</AppText>
        </InstantPressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  backButton: {
    width: minTouchSize,
    height: minTouchSize,
    borderRadius: radius.md,
  },
  headerTitle: {
    ...typography.section,
    flex: 1,
    color: colors.text,
  },
  headerAction: {
    minHeight: minTouchSize,
    minWidth: minTouchSize,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerActionText: textStyle('labelText', colors.textMuted),
  headerSpacer: {
    width: minTouchSize,
  },
});
