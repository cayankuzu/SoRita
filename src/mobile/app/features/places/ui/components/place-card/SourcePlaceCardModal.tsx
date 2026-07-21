import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { PlaceCardSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, spacing, typography } from '@/mobile/app/shared/theme/tokens';

type SourcePlaceCardModalProps = {
  children?: React.ReactNode;
  onClose: () => void;
  visible: boolean;
};

export function SourcePlaceCardModal({
  children,
  onClose,
  visible,
}: SourcePlaceCardModalProps) {
  return (
    <ModalScaffold
      accessibilityLabel={tr.cards.quotedPlace}
      contentContainerStyle={styles.content}
      dismissOnBackdropPress
      onClose={onClose}
      scroll
      variant="sheet"
      visible={visible}
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{tr.cards.quotedPlace}</Text>
        <IconButton accessibilityLabel={tr.common.close} onPress={onClose} variant="surface">
          <X color={colors.textMuted} size={iconSize.md} />
        </IconButton>
      </View>
      {children ?? <PlaceCardSkeleton />}
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.section,
    color: colors.text,
  },
});
