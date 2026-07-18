import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

const splashImageAsset = require('../../../../../assets/splash/launch-splash.png');

export function StartupSplashScreen() {
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Image source={splashImageAsset} resizeMode="cover" style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
