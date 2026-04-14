import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type SettingsHeaderProps = {
  title: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export function SettingsHeader({ title, onBack, actionLabel, onAction }: SettingsHeaderProps) {
  return (
    <View style={styles.header}>
      <InstantPressable onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={20} />
      </InstantPressable>
      <Text style={styles.headerTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <InstantPressable style={styles.headerAction} onPress={onAction}>
          <Text style={styles.headerActionText}>{actionLabel}</Text>
        </InstantPressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerAction: {
    minHeight: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  headerSpacer: {
    width: 36,
  },
});
