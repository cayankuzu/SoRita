import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import {
  PLACE_CATEGORY_META,
  PLACE_CATEGORY_OPTIONS,
} from '@/mobile/app/catalog/placeOptions';
import { OptionRail, RatingSelector } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, fontWeight, radius, textStyle, typography } from '@/mobile/app/shared/theme/tokens';
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
        <AppText style={styles.coordTitle}>{tr.placeEditor.selectedLocation}</AppText>
        <AppText style={styles.coordText}>{address || placeAddress || tr.placeEditor.locationFallback()}</AppText>
        {existingPlaceListName ? (
          <AppText style={styles.coordMeta}>{tr.placeEditor.currentList(existingPlaceListName)}</AppText>
        ) : null}
      </View>

      <View style={styles.requirementsCard}>
        <AppText style={styles.requirementsTitle}>{tr.placeEditor.requirementsTitle}</AppText>
        <AppText style={styles.requirementsText}>{tr.placeEditor.requirementsDescription}</AppText>
      </View>

      <TextField
        label={`${tr.placeEditor.placeNameLabel} (${tr.common.optional})`}
        value={name}
        onChangeText={onNameChange}
        placeholder={tr.placeEditor.placeNamePlaceholder}
        maxLength={PLACE_NAME_MAX_LENGTH}
      />
      <TextField
        label={`${tr.placeEditor.addressLabel} (${tr.common.optional})`}
        value={address}
        onChangeText={onAddressChange}
        placeholder={tr.placeEditor.addressPlaceholder}
        maxLength={PLACE_ADDRESS_MAX_LENGTH}
      />

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{`${tr.placeEditor.rating} (${tr.common.optional})`}</AppText>
        <AppText style={styles.sectionHelper}>{tr.placeEditor.ratingHelper}</AppText>
        <RatingSelector value={rating} onChange={onRatingChange} />
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{`${tr.placeEditor.category} (${tr.common.optional})`}</AppText>
        <AppText style={styles.sectionHelper}>{tr.placeEditor.categoryHelper}</AppText>
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
        <AppText style={styles.selectionMeta}>
          {tr.placeEditor.categorySelectionCount(selectedCategories.length)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    gap: 12,
  },
  coordCard: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.md,
    padding: 10,
  },
  coordTitle: textStyle('metadataText', colors.primary, fontWeight.strong),
  coordText: {
    marginTop: 2,
    ...typography.metadataText,
    fontWeight: fontWeight.regular,
    color: colors.textMuted,
  },
  coordMeta: {
    marginTop: 4,
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.primary,
  },
  requirementsCard: {
    gap: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
  },
  requirementsTitle: textStyle('metadataText', colors.text, fontWeight.strong),
  requirementsText: textStyle('metadataText', colors.textMuted),
  section: {
    gap: 8,
  },
  sectionTitle: textStyle('metadataText', colors.text, fontWeight.strong),
  sectionHelper: {
    marginTop: -2,
    ...typography.metadataText,
    color: colors.textSoft,
  },
  selectionMeta: textStyle('metadataText', colors.primary, fontWeight.strong),
});
