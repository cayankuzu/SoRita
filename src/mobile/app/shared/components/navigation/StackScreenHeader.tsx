import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, controlSize, iconSize, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

type StackScreenHeaderProps = {
  // Inside a screen that already pads for the status bar and the edges, and
  // scrolls with its content (Settings); otherwise a fixed bar with a rule.
  inline?: boolean;
  onBack: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
  title: string;
};

export function StackScreenHeader({
  inline = false,
  onBack,
  rightAction,
  subtitle,
  title,
}: StackScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { screenPadding } = useAppLayout();

  return (
    <View
      style={
        inline
          ? [styles.headerRow, styles.inline]
          : [
              styles.headerRow,
              styles.bar,
              { paddingHorizontal: screenPadding, paddingTop: insets.top + spacing.sm },
            ]
      }
    >
      <IconButton accessibilityLabel={tr.common.back} onPress={onBack}>
        <ArrowLeft color={colors.text} size={iconSize.md} />
      </IconButton>
      <View style={styles.copy}>
        <AppText accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText accessibilityLiveRegion="polite" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {rightAction ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inline: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  bar: {
    minHeight: 64,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  title: textStyle('section', colors.text),
  subtitle: textStyle('captionText', colors.textSoft),
  spacer: {
    width: controlSize.default,
    height: controlSize.default,
  },
});
