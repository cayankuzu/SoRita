import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { colors, fontWeight, spacing, typography } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

const CURRENT_YEAR = new Date().getFullYear();

export function AuthBrandFooter() {
  return (
    <View style={styles.footer}>
      <AppText style={styles.metaText}>{tr.brand.copyright(CURRENT_YEAR)}</AppText>
      <View style={styles.poweredRow}>
        <AppText style={styles.brandText}>{tr.brand.developer}</AppText>
        <AppText style={styles.metaText}> {tr.brand.poweredBy}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    ...typography.metadataText,
    lineHeight: typography.compactTitleText.fontSize,
    textAlign: 'center',
    color: colors.textSoft,
  },
  brandText: {
    ...typography.metadataText,
    lineHeight: typography.compactTitleText.fontSize,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
});
