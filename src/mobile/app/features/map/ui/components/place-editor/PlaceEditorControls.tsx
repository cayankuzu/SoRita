import React, { useMemo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Star, StarHalf } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, fontWeight, iconSize, radius, spacing, textStyle, touch, typography } from '@/mobile/app/shared/theme/tokens';

const MIN_TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;
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
          {column.map((item) => {
            const selected = selectedValues.includes(item);

            return (
              <InstantPressable
                accessibilityLabel={item}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                hapticFeedback="selection"
                key={item}
                onPress={() => onToggle(item)}
                style={[styles.railChip, selected ? styles.railChipSelected : null]}
              >
                <AppText style={[styles.railChipText, selected ? styles.railChipTextSelected : null]}>
                  {item}
                </AppText>
              </InstantPressable>
            );
          })}
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
  optionRail: {
    gap: spacing.sm,
    paddingRight: spacing.md,
    alignItems: 'flex-start',
  },
  optionColumn: {
    gap: spacing.sm,
  },
  railChip: {
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railChipSelected: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  railChipText: textStyle('metadataText', colors.textMuted, fontWeight.strong),
  railChipTextSelected: {
    color: colors.primaryDark,
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
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
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
