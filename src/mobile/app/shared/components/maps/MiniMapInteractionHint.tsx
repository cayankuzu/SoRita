import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { t } from '@/mobile/app/shared/i18n';
import { colors, fontWeight, radius, typography } from '@/mobile/app/shared/theme/tokens';

type MiniMapInteractionHintProps = {
  visible: boolean;
};

export function MiniMapInteractionHint({ visible }: MiniMapInteractionHintProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      <AppText style={styles.title}>{t.map.interactiveHintTitle}</AppText>
      <AppText style={styles.description}>{t.map.interactiveHintDescription}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    left: 8,
    borderRadius: radius.md,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  title: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.onPrimary,
  },
  description: {
    marginTop: 4,
    ...typography.metadataText,
    color: colors.onPrimary,
  },
});
