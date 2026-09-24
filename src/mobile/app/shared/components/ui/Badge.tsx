import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import {
  colors,
  controlSize,
  iconSize,
  radius,
  spacing,
  tabularNumbers,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

/**
 * A static label: a place's rating or price, a list's visibility, a counter.
 * `overlay` is the dark glass variant for badges drawn over photos and video.
 * A badge is never pressable; a selectable pill is a `Chip`.
 */
export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'quote'
  | 'overlay';

const toneColors: Record<BadgeTone, { background: string; content: string }> = {
  neutral: { background: colors.surfaceMuted, content: colors.textMuted },
  primary: { background: colors.primaryBg, content: colors.primaryDark },
  success: { background: colors.successBg, content: colors.secondary },
  warning: { background: colors.warningBg, content: colors.warning },
  danger: { background: colors.dangerBg, content: colors.danger },
  quote: { background: colors.purpleBg, content: colors.purple },
  overlay: { background: colors.darkOverlay, content: colors.onPrimary },
};

/** The ink a badge's label uses, for an icon a caller draws beside one. */
export function badgeContentColor(tone: BadgeTone) {
  return toneColors[tone].content;
}

type BadgeProps = {
  // Omitted for an icon-only badge, which then needs an accessibilityLabel.
  label?: string;
  accessibilityLabel?: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
  iconFilled?: boolean;
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Badge({
  label,
  accessibilityLabel,
  tone = 'neutral',
  icon: Icon,
  iconFilled = false,
  numeric = false,
  style,
}: BadgeProps) {
  const { background, content } = toneColors[tone];

  return (
    // A badge is a label, never a control: touches pass through to what it
    // sits on. "Kapağı aç" over a list cover swallowed the tap on the cover.
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
      style={[styles.badge, label ? null : styles.iconOnly, { backgroundColor: background }, style]}
    >
      {Icon ? (
        <Icon color={content} fill={iconFilled ? content : 'none'} size={iconSize.xs} />
      ) : null}
      {label ? (
        <AppText
          numberOfLines={1}
          style={[styles.label, { color: content }, numeric ? tabularNumbers : null]}
        >
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: controlSize.badge,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  iconOnly: {
    minWidth: controlSize.badge,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  label: textStyle('metadataText', colors.textMuted),
});
