import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, fontWeight, iconSize, radius, spacing, textStyle } from '@/mobile/app/shared/theme/tokens';

type PlaceEditorTransientNoticeProps = {
  description: string;
  title: string;
  onClose: () => void;
};

export function PlaceEditorTransientNotice({
  description,
  title,
  onClose,
}: PlaceEditorTransientNoticeProps) {
  return (
    <InstantPressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityLiveRegion="assertive"
      accessibilityRole="button"
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      style={styles.overlay}
      onPress={onClose}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <AlertTriangle color={colors.danger} size={iconSize.md} />
        </View>
        <View style={styles.copy}>
          <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
          <AppText style={styles.description}>{description}</AppText>
        </View>
      </View>
    </InstantPressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 378,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerBg,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  title: textStyle('bodyText', colors.text, fontWeight.strong),
  description: textStyle('metadataText', colors.textMuted, fontWeight.regular),
});
