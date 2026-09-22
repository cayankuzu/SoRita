import React from 'react';
import { View } from 'react-native';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

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
        <InstantPressable
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          style={styles.backButton}
          onPress={onPrevious}
        >
          <ChevronLeft color={colors.textMuted} size={iconSize.sm} />
          <AppText style={styles.backButtonText}>{tr.common.back}</AppText>
        </InstantPressable>
      ) : onDelete ? (
        <InstantPressable
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          hapticFeedback="warning"
          style={styles.deleteButton}
          onPress={onDelete}
        >
          <Trash2 color={colors.danger} size={iconSize.sm} />
          <AppText style={styles.deleteButtonText}>{tr.common.delete}</AppText>
        </InstantPressable>
      ) : null}

      {!isLastStep ? (
        <InstantPressable
          accessibilityState={{ disabled: !canContinue || isBusy }}
          disabled={!canContinue || isBusy}
          style={[styles.nextButton, !canContinue ? styles.disabledButton : null]}
          onPress={onNext}
          hapticFeedback="light"
        >
          <AppText style={styles.nextButtonText}>{tr.placeEditor.continue}</AppText>
          <ChevronRight color={colors.onPrimary} size={iconSize.sm} />
        </InstantPressable>
      ) : (
        <InstantPressable
          accessibilityState={{ disabled: !canContinue || isBusy }}
          disabled={!canContinue || isBusy}
          style={[styles.nextButton, !canContinue ? styles.disabledButton : null]}
          onPress={onSave}
          hapticFeedback="success"
        >
          <Check color={colors.onPrimary} size={iconSize.sm} />
          <AppText style={styles.nextButtonText}>
            {isEditing ? tr.placeEditor.update : tr.placeEditor.complete}
          </AppText>
        </InstantPressable>
      )}
    </View>
  );
}
