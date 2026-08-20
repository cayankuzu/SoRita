import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

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
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityLiveRegion="assertive"
      accessibilityRole="button"
      accessibilityViewIsModal
      style={styles.overlay}
      onPress={onClose}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <AlertTriangle color={colors.danger} size={18} />
        </View>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 378,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerBg,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
});
