import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Star, StarHalf } from 'lucide-react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type OptionRailProps = {
  options: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
};

export function OptionRail({ options, selectedValues, onToggle }: OptionRailProps) {
  const optionColumns = useMemo(() => {
    const sortedOptions = [...options].sort((left, right) => left.localeCompare(right, 'tr'));
    const columns: string[][] = [];

    for (let index = 0; index < sortedOptions.length; index += 3) {
      columns.push(sortedOptions.slice(index, index + 3));
    }

    return columns;
  }, [options]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRail}>
      {optionColumns.map((column, columnIndex) => (
        <View key={`column-${columnIndex}`} style={styles.optionColumn}>
          {column.map((item) => {
            const selected = selectedValues.includes(item);

            return (
              <Pressable
                key={item}
                onPress={() => onToggle(item)}
                style={[styles.railChip, selected ? styles.railChipSelected : null]}
              >
                <Text style={[styles.railChipText, selected ? styles.railChipTextSelected : null]}>
                  {item}
                </Text>
              </Pressable>
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
            <Pressable
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
                <Star color={colors.warning} fill={colors.warning} size={28} />
              ) : isHalf ? (
                <StarHalf color={colors.warning} fill={colors.warning} size={28} />
              ) : (
                <Star color={colors.cardBorder} size={28} />
              )}
            </Pressable>
          );
        })}
      </View>
      {value > 0 ? <Text style={styles.ratingValue}>{value.toFixed(1)}/5</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  optionRail: {
    gap: 10,
    paddingRight: 16,
    alignItems: 'flex-start',
  },
  optionColumn: {
    gap: 8,
  },
  railChip: {
    minHeight: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  railChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  railChipTextSelected: {
    color: colors.onPrimary,
  },
  ratingSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starButton: {
    paddingVertical: 2,
  },
  ratingValue: {
    minWidth: 58,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.warningBg,
    color: colors.warningText,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
});
