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
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <AlertTriangle color={colors.danger} size={20} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
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
    paddingHorizontal: 24,
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerBg,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
