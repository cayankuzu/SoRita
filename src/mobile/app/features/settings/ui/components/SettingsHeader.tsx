import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, minTouchSize, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

type SettingsHeaderProps = {
  title: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'ghost';
};

export function SettingsHeader({
  title,
  onBack,
  actionLabel,
  onAction,
  actionVariant = 'primary',
}: SettingsHeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel={tr.common.back} onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={18} />
      </IconButton>
      <AppText accessibilityRole="header" style={styles.headerTitle}>{title}</AppText>
      {actionLabel && onAction ? (
        <InstantPressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          style={[
            styles.headerAction,
            actionVariant === 'ghost' ? styles.headerActionGhost : null,
          ]}
          onPress={onAction}
        >
          <AppText
            style={[
              styles.headerActionText,
              actionVariant === 'ghost' ? styles.headerActionTextGhost : null,
            ]}
          >
            {actionLabel}
          </AppText>
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
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  headerActionGhost: {
    backgroundColor: colors.surfaceMuted,
  },
  headerActionText: textStyle('labelText', colors.onPrimary),
  headerActionTextGhost: {
    color: colors.textMuted,
  },
  headerSpacer: {
    width: minTouchSize,
  },
});
