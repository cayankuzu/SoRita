import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, iconSize, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

type PrivacyOptionProps = {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  onPress: () => void;
};

export function PrivacyOption({ active, icon, title, description, disabled = false, onPress }: PrivacyOptionProps) {
  return (
    <InstantPressable
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityRole="radio"
      accessibilityState={{ busy: active && disabled, checked: active, disabled }}
      disabled={disabled}
      hapticFeedback="selection"
      style={[styles.privacyCard, active ? styles.privacyCardActive : null]}
      onPress={onPress}
    >
      <View style={[styles.privacyIcon, active ? styles.privacyIconActive : null]}>{icon}</View>
      <View style={styles.privacyBody}>
        <AppText style={styles.privacyTitle}>{title}</AppText>
        <AppText style={styles.privacyDescription}>{description}</AppText>
      </View>
      {active ? (
        <View style={styles.activeCheck}>
          {disabled ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Check color={colors.onPrimary} size={iconSize.xs} strokeWidth={2.5} />
          )}
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
    gap: spacing.md,
    padding: spacing.card,
  },
  privacyCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  privacyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
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
  privacyTitle: textStyle('labelText', colors.text),
  privacyDescription: {
    marginTop: spacing.xs,
    ...typography.captionText,
    color: colors.textMuted,
  },
  activeCheck: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
