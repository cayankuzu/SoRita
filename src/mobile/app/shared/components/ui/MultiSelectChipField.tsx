import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius, touch } from '@/mobile/app/shared/theme/tokens';

export type MultiSelectChipOption = {
  value: string;
  label: string;
};

type MultiSelectChipFieldProps = {
  options: MultiSelectChipOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
};

export function MultiSelectChipField({
  options,
  selectedValues,
  onToggle,
  disabled = false,
}: MultiSelectChipFieldProps) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const selected = selectedValues.includes(option.value);

        return (
          <InstantPressable
            accessibilityLabel={option.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            hapticFeedback="selection"
            key={option.value}
            onPress={() => onToggle(option.value)}
            style={[styles.chip, selected ? styles.chipSelected : null]}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
              {option.label}
            </Text>
          </InstantPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minHeight: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
