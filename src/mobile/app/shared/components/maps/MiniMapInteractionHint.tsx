import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type MiniMapInteractionHintProps = {
  visible: boolean;
};

export function MiniMapInteractionHint({ visible }: MiniMapInteractionHintProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={styles.title}>Harita artik gezinilebilir</Text>
      <Text style={styles.description}>
        Kaydirip yakinlastirabilirsin. Tekrar sabitlemek icin Odakla'ya 0.5 sn basili tut.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    left: 10,
    borderRadius: radius.md,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  description: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: colors.onPrimary,
  },
});
