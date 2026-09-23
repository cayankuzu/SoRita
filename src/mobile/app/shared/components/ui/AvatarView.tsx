import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppImage } from '@/mobile/app/shared/components/ui/AppImage';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { avatarSize, colors, fontWeight, typography } from '@/mobile/app/shared/theme/tokens';
import { getUserAvatarText } from '@/mobile/app/shared/utils/format';

type AvatarViewProps = {
  uri?: string;
  name?: string;
  size?: number;
};

// Initials take a step of the type scale that fits the circle, instead of a
// fraction of it: 28% of a small avatar printed them at 4px.
function initialsTypeStep(size: number) {
  if (size <= avatarSize.sm) return typography.metadataText;
  if (size <= avatarSize.md) return typography.labelText;
  return typography.title;
}

export function AvatarView({ uri, name, size = avatarSize.md }: AvatarViewProps) {
  const avatarStyle = { width: size, height: size, borderRadius: size / 2 };
  const fallbackTextStyle = [initialsTypeStep(size), styles.fallbackText];
  const fallback = (
    <View style={[styles.fallback, avatarStyle]}>
      <AppText maxFontSizeMultiplier={1} style={fallbackTextStyle}>{getUserAvatarText(name ? { name } : null)}</AppText>
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
    fontWeight: fontWeight.strong,
  },
});
