import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PLACE_BEST_TIME_OPTIONS, PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import { PLACE_EDITOR_COPY } from '@/mobile/app/features/map/catalog/placeEditor';
import { OptionRail } from '@/mobile/app/features/map/ui/components/place-editor/PlaceEditorControls';
import { TextField } from '@/mobile/app/shared/components/ui/TextField';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type PlaceEditorDetailsStepProps = {
  bestTimes: string[];
  dietarySelections: string[];
  priceMax: string;
  priceMin: string;
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
        <Text style={styles.sectionTitle}>{tr.placeEditor.studentDiscount}</Text>
        <View style={styles.segmentedRow}>
          <Pressable
            style={[styles.segmentButton, studentFriendly ? styles.segmentButtonActive : null]}
            onPress={() => onSetStudentFriendly(true)}
          >
            <Text style={[styles.segmentText, studentFriendly ? styles.segmentTextPrimaryActive : null]}>
              {tr.common.yes}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentButton, !studentFriendly ? styles.segmentButtonDark : null]}
            onPress={() => onSetStudentFriendly(false)}
          >
            <Text style={[styles.segmentText, !studentFriendly ? styles.segmentTextDarkActive : null]}>
              {tr.common.no}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{PLACE_EDITOR_COPY.quickFeaturesTitle}</Text>
        <Text style={styles.sectionHelper}>{PLACE_EDITOR_COPY.quickFeaturesHelper}</Text>
        <OptionRail
          options={PLACE_DIETARY_OPTIONS}
          selectedValues={dietarySelections}
          onToggle={onToggleFeature}
        />
        {dietarySelections.length > 0 ? (
          <Text style={styles.selectionMeta}>
            {tr.placeEditor.optionSelectionCount(dietarySelections.length)}
          </Text>
        ) : null}
      </View>

      <View style={styles.inlineFields}>
        <View style={styles.inlineField}>
          <TextField
            label={tr.placeEditor.minPrice}
            value={priceMin}
            onChangeText={onPriceMinChange}
            keyboardType="numeric"
            placeholder={tr.placeEditor.pricePlaceholder}
          />
        </View>
        <View style={styles.inlineField}>
          <TextField
            label={tr.placeEditor.maxPrice}
            value={priceMax}
            onChangeText={onPriceMaxChange}
            keyboardType="numeric"
            placeholder={tr.placeEditor.pricePlaceholder}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{tr.placeEditor.bestTimes}</Text>
        <Text style={styles.sectionHelper}>{tr.placeEditor.bestTimesHelper}</Text>
        <OptionRail options={PLACE_BEST_TIME_OPTIONS} selectedValues={bestTimes} onToggle={onToggleBestTime} />
        {bestTimes.length > 0 ? (
          <Text style={styles.selectionMeta}>
            {tr.placeEditor.timeSelectionCount(bestTimes.length)}
          </Text>
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  sectionHelper: {
    marginTop: -2,
    ...typography.metadataText,
    color: colors.textSoft,
  },
  selectionMeta: {
    ...typography.metadataText,
    fontWeight: '700',
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
    minHeight: 44,
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segmentTextPrimaryActive: {
    color: colors.primary,
  },
  segmentTextDarkActive: {
    color: colors.onPrimary,
  },
});
