import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { tr } from '@/mobile/app/shared/i18n/tr';
import { brandIconAsset } from '@/mobile/app/shared/components/brand/brandAssets';
import { colors } from '@/mobile/app/shared/theme/tokens';

type SoRitaLogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
};

const textSizes = {
  sm: 20,
  md: 26,
  lg: 30,
  xl: 34,
};

const iconSizes = {
  sm: 38,
  md: 58,
  lg: 74,
  xl: 98,
};

const subtitleSizes = {
  sm: 10,
  md: 11,
  lg: 12,
  xl: 13,
};

const gaps = {
  sm: 8,
  md: 10,
  lg: 11,
  xl: 12,
};

export function SoRitaLogo({ size = 'md', showIcon = true }: SoRitaLogoProps) {
  return (
    <View style={[styles.wrap, { gap: gaps[size] }]}>
      {showIcon ? (
        <Image
          source={brandIconAsset}
          style={{ width: iconSizes[size], height: iconSizes[size] }}
          resizeMode="contain"
        />
      ) : null}

      <View>
        <Text style={[styles.title, { fontSize: textSizes[size], lineHeight: textSizes[size] + 2 }]}>
          <Text style={styles.brandPrimary}>{tr.brand.first}</Text>
          <Text style={styles.brandSecondary}>{tr.brand.second}</Text>
        </Text>
        <Text style={[styles.subtitle, { fontSize: subtitleSizes[size], lineHeight: subtitleSizes[size] + 2 }]}>
          <Text style={styles.brandPrimary}>{tr.brand.taglineFirst}</Text>
          <Text style={styles.brandSecondary}>{tr.brand.taglineSecond}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: -2,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  brandPrimary: {
    color: colors.primary,
  },
  brandSecondary: {
    color: colors.secondary,
  },
});
