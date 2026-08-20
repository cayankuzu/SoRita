import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Minus, X } from 'lucide-react-native';

import { placeEditorModalStyles as styles } from '@/mobile/app/features/map/ui/components/place-editor/placeEditorModalStyles';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

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
          <Text accessibilityRole="header" style={styles.headerTitle}>
            {isEditing ? tr.placeEditor.editTitle : tr.placeEditor.createTitle}
          </Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
          {existingPlaceListName ? (
            <Text style={styles.headerMeta}>{tr.placeEditor.currentList(existingPlaceListName)}</Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isLocked }}
            disabled={isLocked}
            onPress={onClose}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>{tr.common.cancel}</Text>
          </Pressable>
          {onMinimize ? (
            <IconButton
              accessibilityLabel={tr.common.minimize}
              disabled={isLocked}
              onPress={onMinimize}
              style={styles.closeButton}
              variant="surface"
            >
              <Minus color={colors.textMuted} size={18} />
            </IconButton>
          ) : null}
          <IconButton
            accessibilityLabel={tr.common.close}
            disabled={isLocked}
            onPress={onClose}
            style={styles.closeButton}
            variant="surface"
          >
            <X color={colors.textMuted} size={18} />
          </IconButton>
        </View>
      </View>
    </View>
  );
}
