import React from 'react';
import { StyleSheet } from 'react-native';

import { SheetHeader } from '@/mobile/app/shared/components/feedback/SheetHeader';
import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';

import { PlaceCardSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { spacing } from '@/mobile/app/shared/theme/tokens';

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
      <SheetHeader onClose={onClose} title={tr.cards.quotedPlace} />
      {children ?? <PlaceCardSkeleton />}
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
});
