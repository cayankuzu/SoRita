import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type SettingsHeaderProps = {
  title: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: 'primary' | 'ghost';
};

export function SettingsHeader({
  title,
  onBack,
  actionLabel,
  onAction,
  actionVariant = 'primary',
}: SettingsHeaderProps) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel={tr.common.back} onPress={onBack} style={styles.backButton}>
        <ArrowLeft color={colors.textMuted} size={20} />
      </IconButton>
      <Text style={styles.headerTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <InstantPressable
          style={[
            styles.headerAction,
            actionVariant === 'ghost' ? styles.headerActionGhost : null,
          ]}
          onPress={onAction}
        >
          <Text
            style={[
              styles.headerActionText,
              actionVariant === 'ghost' ? styles.headerActionTextGhost : null,
            ]}
          >
            {actionLabel}
          </Text>
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
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerAction: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  headerActionGhost: {
    backgroundColor: colors.surfaceMuted,
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  headerActionTextGhost: {
    color: colors.textMuted,
  },
  headerSpacer: {
    width: 44,
  },
});
