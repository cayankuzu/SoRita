import React from 'react';
import { View } from 'react-native';
import { Minus, X } from 'lucide-react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

type PlaceEditorModalHeaderProps = {
  existingPlaceListName?: string;
  isEditing: boolean;
  isLocked?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  subtitle: string;
};

export function PlaceEditorModalHeader({
  existingPlaceListName,
  isEditing,
  isLocked = false,
  onClose,
  onMinimize,
  subtitle,
}: PlaceEditorModalHeaderProps) {
  return (
    <View style={styles.panelTopArea}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText accessibilityRole="header" style={styles.headerTitle}>
            {isEditing ? tr.placeEditor.editTitle : tr.placeEditor.createTitle}
          </AppText>
          <AppText style={styles.headerSubtitle}>{subtitle}</AppText>
          {existingPlaceListName ? (
            <AppText style={styles.headerMeta}>{tr.placeEditor.currentList(existingPlaceListName)}</AppText>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <InstantPressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isLocked }}
            disabled={isLocked}
            onPress={onClose}
            style={styles.cancelButton}
          >
            <AppText style={styles.cancelButtonText}>{tr.common.cancel}</AppText>
          </InstantPressable>
          {onMinimize ? (
            <IconButton
              accessibilityLabel={tr.common.minimize}
              disabled={isLocked}
              onPress={onMinimize}
              style={styles.closeButton}
              variant="surface"
            >
              <Minus color={colors.textMuted} size={iconSize.md} />
            </IconButton>
          ) : null}
          <IconButton
            accessibilityLabel={tr.common.close}
            disabled={isLocked}
            onPress={onClose}
            style={styles.closeButton}
            variant="surface"
          >
            <X color={colors.textMuted} size={iconSize.md} />
          </IconButton>
        </View>
      </View>
    </View>
  );
}
