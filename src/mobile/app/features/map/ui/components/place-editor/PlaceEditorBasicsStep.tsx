import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  PLACE_CATEGORY_META,
  PLACE_CATEGORY_OPTIONS,
} from '@/mobile/app/catalog/placeOptions';
import { OptionRail, RatingSelector } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import {
  PLACE_ADDRESS_MAX_LENGTH,
  PLACE_NAME_MAX_LENGTH,
} from '@/mobile/app/shared/validation/contentLimits';

type PlaceEditorBasicsStepProps = {
  address: string;
  existingPlaceListName?: string;
  name: string;
  placeAddress?: string;
  rating: number;
  selectedCategories: string[];
  onAddressChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onRatingChange: (value: number) => void;
  onToggleCategory: (value: string) => void;
};

export function PlaceEditorBasicsStep({
  address,
  existingPlaceListName,
  name,
  placeAddress,
  rating,
  selectedCategories,
  onAddressChange,
  onNameChange,
  onRatingChange,
  onToggleCategory,
}: PlaceEditorBasicsStepProps) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.coordCard}>
        <Text style={styles.coordTitle}>{tr.placeEditor.selectedLocation}</Text>
        <Text style={styles.coordText}>{address || placeAddress || tr.placeEditor.locationFallback()}</Text>
        {existingPlaceListName ? (
          <Text style={styles.coordMeta}>{tr.placeEditor.currentList(existingPlaceListName)}</Text>
        ) : null}
      </View>

      <TextField
        label={tr.placeEditor.placeNameLabel}
        value={name}
        onChangeText={onNameChange}
        placeholder={tr.placeEditor.placeNamePlaceholder}
        maxLength={PLACE_NAME_MAX_LENGTH}
      />
      <TextField
        label={tr.placeEditor.addressLabel}
        value={address}
        onChangeText={onAddressChange}
        placeholder={tr.placeEditor.addressPlaceholder}
        maxLength={PLACE_ADDRESS_MAX_LENGTH}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.rating}</Text>
        <Text style={styles.sectionHelper}>{tr.placeEditor.ratingHelper}</Text>
        <RatingSelector value={rating} onChange={onRatingChange} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.category}</Text>
        <Text style={styles.sectionHelper}>{tr.placeEditor.categoryHelper}</Text>
        <OptionRail
          options={PLACE_CATEGORY_OPTIONS.map((item) => item.label)}
          selectedValues={selectedCategories.map(
            (item) => PLACE_CATEGORY_META[item]?.label || PLACE_CATEGORY_META.other.label,
          )}
          onToggle={(label) => {
            const selectedCategory = PLACE_CATEGORY_OPTIONS.find((item) => item.label === label);
            onToggleCategory(selectedCategory?.value || 'other');
          }}
        />
        <Text style={styles.selectionMeta}>
          {tr.placeEditor.categorySelectionCount(selectedCategories.length)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    gap: 16,
  },
  coordCard: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    padding: 14,
  },
  coordTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  coordText: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  coordMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  sectionHelper: {
    marginTop: -2,
    fontSize: 11,
    color: colors.textSoft,
  },
  selectionMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
});
