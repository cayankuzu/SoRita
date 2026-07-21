import React from 'react';
import { Settings } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/mobile/app/shared/components/ui/PrimaryButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type OwnProfileActionBarProps = {
  onOpenSettings: () => void;
};

export function OwnProfileActionBar({ onOpenSettings }: OwnProfileActionBarProps) {
  return (
    <View style={styles.actionRow}>
      <PrimaryButton
        title={tr.profile.actions.settings}
        variant="secondary"
        onPress={onOpenSettings}
        icon={<Settings color={colors.textMuted} size={12} />}
        style={styles.actionButton}
        textStyle={styles.actionButtonText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    minWidth: 96,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
