import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCopyrightLabel, brandMeta } from '@/mobile/app/catalog/brand';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { brandIconAsset } from '@/mobile/app/shared/components/brand/brandAssets';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export function AppSplashScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={styles.logoCard}>
          <Image source={brandIconAsset} style={styles.heroImage} resizeMode="contain" />
        </View>
        <View style={styles.logoBlock}>
          <SoRitaLogo size="lg" showIcon={false} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.copyright}>{getCopyrightLabel(2026)}</Text>
        <Text style={styles.poweredBy}>{`Powered by ${brandMeta.poweredBy}`}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: colors.background,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logoCard: {
    width: 156,
    height: 156,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  heroImage: {
    width: 124,
    height: 124,
  },
  logoBlock: {
    marginTop: 22,
  },
  footer: {
    alignItems: 'center',
    gap: 4,
  },
  copyright: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  poweredBy: {
    fontSize: 12,
    color: colors.textSoft,
  },
});
