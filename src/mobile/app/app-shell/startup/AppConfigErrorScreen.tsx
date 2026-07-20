import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, spacing, typography } from '@/mobile/app/shared/theme/tokens';

type AppConfigErrorScreenProps = {
  missingEnvVars: readonly string[];
};

export function AppConfigErrorScreen({ missingEnvVars }: AppConfigErrorScreenProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.card}>
        <SoRitaLogo size="lg" showIcon />
        <Text style={styles.title}>{tr.system.configErrorTitle}</Text>
        <Text style={styles.body}>{tr.system.configErrorDescription}</Text>
        <View style={styles.list}>
          {missingEnvVars.map((item) => (
            <Text key={item} style={styles.listItem}>
              {item}
            </Text>
          ))}
        </View>
        <Text style={styles.hint}>{tr.system.configErrorHint}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    backgroundColor: colors.background,
  },
  card: {
    gap: 14,
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  title: {
    fontSize: typography.screenTitle,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: typography.body,
    lineHeight: 21,
    color: colors.textMuted,
  },
  list: {
    gap: 8,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  listItem: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: typography.caption,
    lineHeight: 18,
    color: colors.textSoft,
  },
});
