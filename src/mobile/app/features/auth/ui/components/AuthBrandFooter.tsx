import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

export function AuthBrandFooter() {
  return (
    <View style={styles.footer}>
      <Text style={styles.metaText}>Copyright (c) 2026 SoRita. Tum haklari saklidir.</Text>
      <View style={styles.poweredRow}>
        <Text style={styles.metaText}>Powered by</Text>
        <Text style={styles.brandText}> MeMoDe</Text>
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
