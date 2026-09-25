import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Star, StarHalf } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Chip } from '@/mobile/app/shared/components/ui/Chip';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  controlSize,
  fontWeight,
  hitSlopFor,
  iconSize,
  radius,
  spacing,
  typography,
} from '@/mobile/app/shared/theme/tokens';

import { compareLocalizedText } from '@/mobile/app/shared/utils/textSort';

type OptionRailProps = {
  options: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
};

export function OptionRail({ options, selectedValues, onToggle }: OptionRailProps) {
  const optionColumns = useMemo(() => {
    const sortedOptions = [...options].sort(compareLocalizedText);
    const columns: string[][] = [];

    for (let index = 0; index < sortedOptions.length; index += 3) {
      columns.push(sortedOptions.slice(index, index + 3));
    }

    return columns;
  }, [options]);

  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.optionRail}
    >
      {optionColumns.map((column, columnIndex) => (
        <View key={`column-${columnIndex}`} style={styles.optionColumn}>
          {column.map((item) => (
            <Chip
              key={item}
              label={item}
              onPress={() => onToggle(item)}
              selected={selectedValues.includes(item)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

type RatingSelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

export function RatingSelector({ value, onChange }: RatingSelectorProps) {
  return (
    <View style={styles.ratingSelector}>
      <View style={styles.ratingStars}>
        {[0, 1, 2, 3, 4].map((index) => {
          const starValue = value - index;
          const isFull = starValue >= 1;
          const isHalf = starValue >= 0.5 && starValue < 1;

          return (
            <InstantPressable
              hitSlop={hitSlopFor(controlSize.default)}
              accessibilityLabel={`${index + 1}. ${tr.placeEditor.rating}`}
              accessibilityHint={tr.placeEditor.ratingHelper}
              accessibilityRole="button"
              key={index}
              onPress={() => {
                if (starValue <= 0) {
                  onChange(index + 0.5);
                  return;
                }

                if (starValue === 0.5) {
                  onChange(index + 1);
                  return;
                }

                onChange(index);
              }}
              style={styles.starButton}
            >
              {isFull ? (
                <Star color={colors.rating} fill={colors.rating} size={iconSize.lg} />
              ) : isHalf ? (
                <StarHalf color={colors.rating} fill={colors.rating} size={iconSize.lg} />
              ) : (
                <Star color={colors.cardBorder} size={iconSize.lg} />
              )}
            </InstantPressable>
          );
        })}
      </View>
      {value > 0 ? <AppText style={styles.ratingValue}>{value.toFixed(1)}/5</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Chips reach 48dp through slop; a 12dp gap keeps neighbours' targets apart.
  optionRail: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    alignItems: 'flex-start',
  },
  optionColumn: {
    gap: spacing.md,
  },
  ratingSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  starButton: {
    minWidth: controlSize.default,
    minHeight: controlSize.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: {
    minWidth: 50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningBg,
    color: colors.warning,
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    textAlign: 'center',
  },
});
