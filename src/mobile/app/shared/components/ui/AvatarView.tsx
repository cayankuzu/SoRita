import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { tr } from '@/mobile/app/shared/i18n/tr';
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
  const fallback = (
    <View style={[styles.fallback, avatarStyle]}>
      <Text style={fallbackTextStyle}>{getUserAvatarText(name ? { name } : null)}</Text>
    </View>
  );

  return (
    <AppImage
      uri={uri}
      style={avatarStyle}
      fallback={fallback}
      accessibilityLabel={tr.common.profilePhotoLabel(name)}
    />
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
