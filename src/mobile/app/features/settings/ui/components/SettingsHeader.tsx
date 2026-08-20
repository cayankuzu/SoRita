import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, touch } from '@/mobile/app/shared/theme/tokens';

const HEADER_TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;

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
        <ArrowLeft color={colors.textMuted} size={18} />
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
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
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
    minHeight: HEADER_TOUCH_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerActionGhost: {
    backgroundColor: colors.surfaceMuted,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  headerActionTextGhost: {
    color: colors.textMuted,
  },
  headerSpacer: {
    width: HEADER_TOUCH_SIZE,
  },
});
