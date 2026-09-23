import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';

import { AppText, type AppTextRef } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  iconSize,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

type SheetHeaderProps = {
  title: string;
  subtitle?: string | null;
  // An icon on a tinted disc, for sheets whose subject needs a mark (report, legal).
  leading?: { icon: React.ReactNode; background: string };
  onClose: () => void;
  closeDisabled?: boolean;
  // A hairline under the header, for sheets whose body scrolls under it.
  divided?: boolean;
  titleRef?: React.Ref<AppTextRef>;
  style?: StyleProp<ViewStyle>;
};

/**
 * The one header every sheet uses. Seven sheets had written their own: titles
 * at 16 and 18, subtitles in two sizes, icon discs at 30 and 32.
 */
export function SheetHeader({
  title,
  subtitle,
  leading,
  onClose,
  closeDisabled = false,
  divided = false,
  titleRef,
  style,
}: SheetHeaderProps) {
  return (
    <View style={[styles.header, divided ? styles.divided : null, style]}>
      {leading ? (
        <View style={[styles.leading, { backgroundColor: leading.background }]}>{leading.icon}</View>
      ) : null}
      <View style={styles.copy}>
        <AppText ref={titleRef} accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? <AppText style={styles.subtitle}>{subtitle}</AppText> : null}
      </View>
      <IconButton
        accessibilityLabel={tr.common.close}
        disabled={closeDisabled}
        onPress={onClose}
        variant="surface"
      >
        <X color={colors.textMuted} size={iconSize.sm} />
      </IconButton>
    </View>
  );
}

const LEADING_SIZE = iconSize.xl;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  divided: {
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  leading: {
    width: LEADING_SIZE,
    height: LEADING_SIZE,
    borderRadius: LEADING_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  title: textStyle('compactTitleText', colors.text),
  subtitle: textStyle('compactBodyText', colors.textSoft),
});
