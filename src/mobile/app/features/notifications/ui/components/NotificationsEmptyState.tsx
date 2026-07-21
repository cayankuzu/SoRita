import React from 'react';
import { Heart } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type NotificationsEmptyStateProps = {
  title: string;
  description: string;
};

export function NotificationsEmptyState({ title, description }: NotificationsEmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Heart color={colors.textSoft} size={24} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 38,
    paddingBottom: 50,
  },
  iconWrap: {
    width: 56,
    height: 56,
    marginBottom: 10,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
