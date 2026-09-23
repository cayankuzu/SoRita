import React from 'react';
import { StyleSheet } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize, spacing } from '@/mobile/app/shared/theme/tokens';

type PasswordToggleProps = {
  visible: boolean;
  onPress: () => void;
};

export function PasswordToggle({ visible, onPress }: PasswordToggleProps) {
  return (
    <IconButton
      accessibilityLabel={visible ? tr.common.hidePassword : tr.common.showPassword}
      accessibilityState={{ selected: visible }}
      onPress={onPress}
      style={styles.passwordToggle}
    >
      {visible ? <EyeOff color={colors.textSoft} size={iconSize.sm} /> : <Eye color={colors.textSoft} size={iconSize.sm} />}
    </IconButton>
  );
}

const styles = StyleSheet.create({
  passwordToggle: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
