import React from 'react';
import {
  Heart } from 'lucide-react-native';
import { StyleSheet,
  View,
} from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { colors, fontWeight, radius, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

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
      <AppText style={styles.title}>{title}</AppText>
      <AppText style={styles.description}>{description}</AppText>
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
  title: textStyle('bodyText', colors.text, fontWeight.strong),
  description: {
    marginTop: 4,
    ...typography.compactBodyText,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
