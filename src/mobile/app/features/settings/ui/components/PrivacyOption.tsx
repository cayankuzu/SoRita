import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type PrivacyOptionProps = {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
};

export function PrivacyOption({ active, icon, title, description, onPress }: PrivacyOptionProps) {
  return (
    <InstantPressable style={[styles.privacyCard, active ? styles.privacyCardActive : null]} onPress={onPress}>
      <View style={[styles.privacyIcon, active ? styles.privacyIconActive : null]}>{icon}</View>
      <View style={styles.privacyBody}>
        <Text style={styles.privacyTitle}>{title}</Text>
        <Text style={styles.privacyDescription}>{description}</Text>
      </View>
      {active ? <View style={styles.activeDot} /> : null}
    </InstantPressable>
  );
}

const styles = StyleSheet.create({
  privacyCard: {
    minHeight: 74,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  privacyCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  privacyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  privacyIconActive: {
    backgroundColor: colors.primary,
  },
  privacyBody: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  privacyDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});
