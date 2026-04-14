import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';

type PasswordToggleProps = {
  visible: boolean;
  onPress: () => void;
};

export function PasswordToggle({ visible, onPress }: PasswordToggleProps) {
  return (
    <Pressable style={styles.passwordToggle} onPress={onPress}>
      {visible ? <EyeOff color={colors.textSoft} size={18} /> : <Eye color={colors.textSoft} size={18} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  passwordToggle: {
    position: 'absolute',
    right: 12,
    bottom: 13,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
