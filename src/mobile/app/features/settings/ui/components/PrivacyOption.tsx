import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type PrivacyOptionProps = {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onPress: () => void;
};

export function PrivacyOption({ active, icon, title, description, onPress }: PrivacyOptionProps) {
  return (
    <InstantPressable
      hapticFeedback="selection"
      style={[styles.privacyCard, active ? styles.privacyCardActive : null]}
      onPress={onPress}
    >
      <View style={[styles.privacyIcon, active ? styles.privacyIconActive : null]}>{icon}</View>
      <View style={styles.privacyBody}>
        <Text style={styles.privacyTitle}>{title}</Text>
        <Text style={styles.privacyDescription}>{description}</Text>
      </View>
      {active ? (
        <View style={styles.activeCheck}>
          <Check color={colors.onPrimary} size={12} strokeWidth={2.5} />
        </View>
      ) : null}
    </InstantPressable>
  );
}

const styles = StyleSheet.create({
  privacyCard: {
    minHeight: 64,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  privacyCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  privacyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  privacyIconActive: {
    backgroundColor: colors.primaryBg,
  },
  privacyBody: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  privacyDescription: {
    marginTop: 3,
    ...typography.metadataText,
    lineHeight: 15,
    color: colors.textMuted,
  },
  activeCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
