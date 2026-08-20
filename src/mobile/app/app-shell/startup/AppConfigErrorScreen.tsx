import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 10,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  title: {
    fontSize: typography.screenTitle,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: typography.body,
    lineHeight: 18,
    color: colors.textMuted,
  },
  list: {
    gap: 6,
    padding: 10,
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
    lineHeight: 16,
    color: colors.textSoft,
  },
});
