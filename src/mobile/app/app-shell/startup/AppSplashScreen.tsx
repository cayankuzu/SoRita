import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

const launchSplashAsset = require('../../../../../assets/splash/launch-splash.png');

export function AppSplashScreen() {
  return (
    <View style={styles.screen}>
      <Image source={launchSplashAsset} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
