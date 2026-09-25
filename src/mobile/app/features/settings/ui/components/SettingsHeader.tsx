import React from 'react';
import { StyleSheet } from 'react-native';

import { StackScreenHeader } from '@/mobile/app/shared/components/navigation/StackScreenHeader';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, minTouchSize, radius, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

type SettingsHeaderProps = {
  title: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

// The app's one stack header, laid inline so it scrolls with the settings
// page; Settings adds only its text action ("İptal" while editing).
export function SettingsHeader({
  title,
  onBack,
  actionLabel,
  onAction,
}: SettingsHeaderProps) {
  return (
    <StackScreenHeader
      inline
      onBack={onBack}
      title={title}
      rightAction={
        actionLabel && onAction ? (
          <InstantPressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            style={styles.headerAction}
            onPress={onAction}
          >
            <AppText style={styles.headerActionText}>{actionLabel}</AppText>
          </InstantPressable>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  headerAction: {
    minHeight: minTouchSize,
    minWidth: minTouchSize,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerActionText: textStyle('labelText', colors.textMuted),
});
