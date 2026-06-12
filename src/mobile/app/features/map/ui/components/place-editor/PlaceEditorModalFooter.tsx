import React from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type PlaceEditorModalFooterProps = {
  canContinue: boolean;
  isEditing: boolean;
  isBusy?: boolean;
  isLastStep: boolean;
  onDelete?: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSave: () => void | Promise<void>;
  paddingBottom: number;
  step: number;
};

export function PlaceEditorModalFooter({
  canContinue,
  isEditing,
  isBusy = false,
  isLastStep,
  onDelete,
  onNext,
  onPrevious,
  onSave,
  paddingBottom,
  step,
}: PlaceEditorModalFooterProps) {
  return (
    <View style={[styles.footer, { paddingBottom }]}>
      {step > 0 ? (
        <Pressable disabled={isBusy} style={styles.backButton} onPress={onPrevious}>
          <ChevronLeft color={colors.textMuted} size={16} />
          <Text style={styles.backButtonText}>{tr.common.back}</Text>
        </Pressable>
      ) : onDelete ? (
        <Pressable disabled={isBusy} style={styles.deleteButton} onPress={onDelete}>
          <Trash2 color={colors.danger} size={16} />
          <Text style={styles.deleteButtonText}>{tr.common.delete}</Text>
        </Pressable>
      ) : null}

      {!isLastStep ? (
        <InstantPressable
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue || isBusy}
          style={[styles.nextButton, !canContinue ? styles.disabledButton : null]}
          onPress={onNext}
        >
          <Text style={styles.nextButtonText}>{tr.placeEditor.continue}</Text>
          <ChevronRight color={colors.onPrimary} size={16} />
        </InstantPressable>
      ) : (
        <InstantPressable
          accessibilityState={{ disabled: !canContinue }}
          disabled={!canContinue || isBusy}
          style={[styles.nextButton, !canContinue ? styles.disabledButton : null]}
          onPress={onSave}
        >
          <Check color={colors.onPrimary} size={16} />
          <Text style={styles.nextButtonText}>
            {isEditing ? tr.placeEditor.update : tr.placeEditor.complete}
          </Text>
        </InstantPressable>
      )}
    </View>
  );
}
