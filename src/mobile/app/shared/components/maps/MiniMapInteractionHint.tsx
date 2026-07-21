import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/mobile/app/shared/i18n';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type MiniMapInteractionHintProps = {
  visible: boolean;
};

export function MiniMapInteractionHint({ visible }: MiniMapInteractionHintProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={styles.title}>{t.map.interactiveHintTitle}</Text>
      <Text style={styles.description}>{t.map.interactiveHintDescription}</Text>
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  description: {
    marginTop: 4,
    ...typography.metadataText,
    lineHeight: 15,
    color: colors.onPrimary,
  },
});
