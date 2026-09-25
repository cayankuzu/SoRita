import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { t } from '@/mobile/app/shared/i18n';
import { colors, fontWeight, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

type MiniMapInteractionHintProps = {
  // How to lock the map again where it is not the card's Focus button.
  description?: string;
  visible: boolean;
};

export function MiniMapInteractionHint({ description, visible }: MiniMapInteractionHintProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      <AppText style={styles.title}>{t.map.interactiveHintTitle}</AppText>
      <AppText style={styles.description}>{description ?? t.map.interactiveHintDescription}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    left: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: textStyle('metadataText', colors.onPrimary, fontWeight.strong),
  description: {
    marginTop: spacing.xs,
    ...typography.metadataText,
    color: colors.onPrimary,
  },
});
