import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/mobile/app/shared/theme/tokens';
import { getUserAvatarText } from '@/mobile/app/shared/utils/format';

type AvatarViewProps = {
  uri?: string;
  name?: string;
  size?: number;
};

export function AvatarView({ uri, name, size = 40 }: AvatarViewProps) {
  const avatarStyle = { width: size, height: size, borderRadius: size / 2 };
  const fallbackTextStyle = [styles.fallbackText, { fontSize: size * 0.28 }];

  if (uri) {
    return <Image source={{ uri }} style={avatarStyle} />;
  }

  return (
    <View style={[styles.fallback, avatarStyle]}>
      <Text style={fallbackTextStyle}>{getUserAvatarText(name ? { name } : null)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  fallbackText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
