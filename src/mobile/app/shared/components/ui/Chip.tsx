import React from 'react';
import { StyleSheet, type ViewProps } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import {
  colors,
  controlSize,
  hitSlopFor,
  opacity,
  radius,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

/**
 * `filter` picks one view of a set - Explore's tabs, the media picker's photo
 * or video - and fills dark when selected. `choice` toggles an option on or
 * off - interests, place features - and tints when selected.
 */
export type ChipKind = 'filter' | 'choice';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  kind?: ChipKind;
  accessibilityRole?: 'tab' | 'radio' | 'checkbox';
  disabled?: boolean;
  leading?: React.ReactNode;
  onLayout?: ViewProps['onLayout'];
  // A row of tabs above content, like Explore's, uses the smaller chip.
  size?: 'default' | 'compact';
};

/** The ink a chip's label uses, so a leading icon can match it. */
export function chipContentColor(kind: ChipKind, selected: boolean) {
  if (!selected) return colors.textMuted;
  return kind === 'filter' ? colors.onPrimary : colors.primaryDark;
}

export function Chip({
  label,
  selected,
  onPress,
  kind = 'choice',
  accessibilityRole = kind === 'filter' ? 'tab' : 'checkbox',
  disabled = false,
  leading,
  onLayout,
  size = 'default',
}: ChipProps) {
  const compact = size === 'compact';
  return (
    <InstantPressable
      accessibilityLabel={label}
      accessibilityRole={accessibilityRole}
      accessibilityState={
        accessibilityRole === 'tab'
          ? { selected, disabled }
          : { checked: selected, disabled }
      }
      disabled={disabled}
      hapticFeedback="selection"
      // Sized for the compact chip, which also carries the default one past
      // 48dp; the touch-target guard reads one static hitSlopFor call.
      hitSlop={hitSlopFor(controlSize.compact)}
      onLayout={onLayout}
      onPress={onPress}
      style={[
        styles.chip,
        compact ? styles.chipCompact : null,
        selected ? (kind === 'filter' ? styles.filterSelected : styles.choiceSelected) : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {leading}
      <AppText
        numberOfLines={1}
        style={[styles.label, compact ? styles.labelCompact : null, { color: chipContentColor(kind, selected) }]}
      >
        {label}
      </AppText>
    </InstantPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: controlSize.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  chipCompact: {
    minHeight: controlSize.compact,
    paddingHorizontal: spacing.md,
  },
  filterSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  choiceSelected: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  label: textStyle('supportingLabelText', colors.textMuted),
  labelCompact: textStyle('metadataText', colors.textMuted),
});
