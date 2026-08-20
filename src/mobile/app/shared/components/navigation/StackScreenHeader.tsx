import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, touch, typography } from '@/mobile/app/shared/theme/tokens';

const TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;

type StackScreenHeaderProps = {
  onBack: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
  title: string;
};

export function StackScreenHeader({
  onBack,
  rightAction,
  subtitle,
  title,
}: StackScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { screenPadding } = useAppLayout();

  return (
    <View
      style={[
        styles.header,
        { paddingHorizontal: screenPadding, paddingTop: insets.top + 8 },
      ]}
    >
      <IconButton accessibilityLabel={tr.common.back} onPress={onBack} variant="surface">
        <ArrowLeft color={colors.text} size={18} />
      </IconButton>
      <View style={styles.copy}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAction ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    ...typography.metadataText,
    color: colors.textSoft,
  },
  spacer: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
  },
});
