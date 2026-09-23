import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/mobile/app/shared/components/ui/Chip';
import { spacing } from '@/mobile/app/shared/theme/tokens';

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
      {options.map((option) => (
        <Chip
          disabled={disabled}
          key={option.value}
          label={option.label}
          onPress={() => onToggle(option.value)}
          selected={selectedValues.includes(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
