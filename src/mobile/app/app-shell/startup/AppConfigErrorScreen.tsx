import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  radius,
  spacing,
  typography,
} from '@/mobile/app/shared/theme/tokens';

const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

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
          <Text accessibilityRole="header" style={styles.title}>{tr.system.configErrorTitle}</Text>
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.body}>
            {tr.system.configErrorDescription}
          </Text>
          {isDevMode && missingEnvVars.length > 0 ? (
            <View style={styles.list}>
              <Text style={styles.developerLabel}>{tr.system.configErrorDeveloperDetails}</Text>
              {missingEnvVars.map((item) => (
                <Text key={item} style={styles.listItem}>
                  {item}
                </Text>
              ))}
            </View>
          ) : null}
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
    fontSize: typography.title.fontSize,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  body: {
    ...typography.bodyText,
    color: colors.textMuted,
  },
  list: {
    gap: 6,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  listItem: {
    fontSize: typography.bodyText.fontSize,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  developerLabel: {
    fontSize: typography.labelText.fontSize,
    fontWeight: fontWeight.strong,
    color: colors.textMuted,
  },
  hint: {
    ...typography.captionText,
    fontWeight: fontWeight.regular,
    color: colors.textSoft,
  },
});
