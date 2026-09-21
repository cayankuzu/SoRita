import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { PLACE_BEST_TIME_OPTIONS, PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import { PLACE_EDITOR_COPY } from '@/mobile/app/features/map/catalog/placeEditor';
import { OptionRail } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  minTouchSize,
  radius,
  typography,
} from '@/mobile/app/shared/theme/tokens';

type PlaceEditorDetailsStepProps = {
  bestTimes: string[];
  dietarySelections: string[];
  priceMax: string;
  priceMin: string;
  priceRangeIsValid: boolean;
  studentFriendly: boolean;
  onPriceMaxChange: (value: string) => void;
  onPriceMinChange: (value: string) => void;
  onSetStudentFriendly: (value: boolean) => void;
  onToggleBestTime: (value: string) => void;
  onToggleFeature: (value: string) => void;
};

export function PlaceEditorDetailsStep({
  bestTimes,
  dietarySelections,
  priceMax,
  priceMin,
  priceRangeIsValid,
  studentFriendly,
  onPriceMaxChange,
  onPriceMinChange,
  onSetStudentFriendly,
  onToggleBestTime,
  onToggleFeature,
}: PlaceEditorDetailsStepProps) {
  return (
    <View style={styles.stepContent}>
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{`${tr.placeEditor.studentDiscount} (${tr.common.optional})`}</AppText>
        <View
          accessibilityLabel={tr.placeEditor.studentDiscount}
          accessibilityRole="radiogroup"
          style={styles.segmentedRow}
        >
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: studentFriendly }}
            style={[styles.segmentButton, studentFriendly ? styles.segmentButtonActive : null]}
            onPress={() => onSetStudentFriendly(true)}
          >
            <AppText style={[styles.segmentText, studentFriendly ? styles.segmentTextPrimaryActive : null]}>
              {tr.common.yes}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: !studentFriendly }}
            style={[styles.segmentButton, !studentFriendly ? styles.segmentButtonDark : null]}
            onPress={() => onSetStudentFriendly(false)}
          >
            <AppText style={[styles.segmentText, !studentFriendly ? styles.segmentTextDarkActive : null]}>
              {tr.common.no}
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{PLACE_EDITOR_COPY.quickFeaturesTitle}</AppText>
        <AppText style={styles.sectionHelper}>{PLACE_EDITOR_COPY.quickFeaturesHelper}</AppText>
        <OptionRail
          options={PLACE_DIETARY_OPTIONS}
          selectedValues={dietarySelections}
          onToggle={onToggleFeature}
        />
        {dietarySelections.length > 0 ? (
          <AppText style={styles.selectionMeta}>
            {tr.placeEditor.optionSelectionCount(dietarySelections.length)}
          </AppText>
        ) : null}
      </View>

      <View style={styles.inlineFields}>
        <View style={styles.inlineField}>
          <TextField
            label={`${tr.placeEditor.minPrice} (₺, ${tr.common.optional})`}
            value={priceMin}
            onChangeText={onPriceMinChange}
            keyboardType="numeric"
            placeholder={tr.placeEditor.pricePlaceholder}
          />
        </View>
        <View style={styles.inlineField}>
          <TextField
            helper={
              priceRangeIsValid
                ? tr.placeEditor.priceRangeHelper
                : tr.placeEditor.priceRangeInvalid
            }
            helperTone={priceRangeIsValid ? 'muted' : 'danger'}
            label={`${tr.placeEditor.maxPrice} (₺, ${tr.common.optional})`}
            value={priceMax}
            onChangeText={onPriceMaxChange}
            keyboardType="numeric"
            placeholder={tr.placeEditor.pricePlaceholder}
            status={priceRangeIsValid ? 'default' : 'error'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>{tr.placeEditor.bestTimes}</AppText>
        <AppText style={styles.sectionHelper}>{tr.placeEditor.bestTimesHelper}</AppText>
        <OptionRail options={PLACE_BEST_TIME_OPTIONS} selectedValues={bestTimes} onToggle={onToggleBestTime} />
        {bestTimes.length > 0 ? (
          <AppText style={styles.selectionMeta}>
            {tr.placeEditor.timeSelectionCount(bestTimes.length)}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepContent: {
    gap: 12,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  sectionHelper: {
    marginTop: -2,
    ...typography.metadataText,
    color: colors.textSoft,
  },
  selectionMeta: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.primary,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    minHeight: minTouchSize,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  segmentButtonDark: {
    backgroundColor: colors.text,
  },
  segmentText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textMuted,
  },
  segmentTextPrimaryActive: {
    color: colors.primary,
  },
  segmentTextDarkActive: {
    color: colors.onPrimary,
  },
});
