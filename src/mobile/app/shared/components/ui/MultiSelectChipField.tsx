import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export type MultiSelectChipOption = {
  value: string;
  label: string;
};

type MultiSelectChipFieldProps = {
  options: MultiSelectChipOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
};

export function MultiSelectChipField({
  options,
  selectedValues,
  onToggle,
}: MultiSelectChipFieldProps) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const selected = selectedValues.includes(option.value);

        return (
          <Pressable
            key={option.value}
            onPress={() => onToggle(option.value)}
            style={[styles.chip, selected ? styles.chipSelected : null]}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextSelected: {
    color: colors.primaryDark,
  },
});
