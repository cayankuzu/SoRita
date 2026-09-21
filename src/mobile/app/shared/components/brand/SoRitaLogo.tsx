import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { brandIconAsset } from '@/mobile/app/shared/components/brand/brandAssets';
import {
  colors,
  fontWeight,
  letterSpacing,
  typography,
} from '@/mobile/app/shared/theme/tokens';

type SoRitaLogoProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
  showTagline?: boolean;
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

const subtitleTypography = {
  sm: typography.metadataText,
  md: typography.metadataText,
  lg: typography.metadataText,
  xl: typography.captionText,
};

const gaps = {
  sm: 8,
  md: 10,
  lg: 11,
  xl: 12,
};

export function SoRitaLogo({
  size = 'md',
  showIcon = true,
  showTagline = true,
}: SoRitaLogoProps) {
  const accessibilityLabel = showTagline
    ? `${tr.brand.first}${tr.brand.second}, ${tr.brand.taglineFirst} ${tr.brand.taglineSecond.trim()}`
    : `${tr.brand.first}${tr.brand.second}`;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="header"
      accessible
      style={[styles.wrap, { gap: gaps[size] }]}
    >
      {showIcon ? (
        <Image
          source={brandIconAsset}
          style={{ width: iconSizes[size], height: iconSizes[size] }}
          resizeMode="contain"
        />
      ) : null}

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <AppText style={[styles.title, { fontSize: textSizes[size], lineHeight: textSizes[size] + 2 }]}>
          <AppText style={styles.brandPrimary}>{tr.brand.first}</AppText>
          <AppText style={styles.brandSecondary}>{tr.brand.second}</AppText>
        </AppText>
        {showTagline ? (
          <AppText style={[styles.subtitle, subtitleTypography[size]]}>
            <AppText style={styles.brandPrimary}>{tr.brand.taglineFirst}</AppText>
            <AppText style={styles.brandSecondary}>{tr.brand.taglineSecond}</AppText>
          </AppText>
        ) : null}
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
    fontWeight: fontWeight.heavy,
    letterSpacing: letterSpacing.brandTitle,
  },
  subtitle: {
    marginTop: -2,
    fontWeight: fontWeight.medium,
    letterSpacing: letterSpacing.brandTagline,
  },
  brandPrimary: {
    color: colors.primary,
  },
  brandSecondary: {
    color: colors.secondary,
  },
});
