import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

export function AuthBrandFooter() {
  return (
    <View style={styles.footer}>
      <Text style={styles.metaText}>{tr.brand.copyright(2026)}</Text>
      <View style={styles.poweredRow}>
        <Text style={styles.metaText}>{tr.brand.poweredBy}</Text>
        <Text style={styles.brandText}> {tr.brand.developer}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    gap: 4,
    marginTop: 18,
    paddingBottom: 8,
  },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textSoft,
  },
  brandText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: colors.text,
  },
});
