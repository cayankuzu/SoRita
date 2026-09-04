import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, minTouchSize, radius } from '@/mobile/app/shared/theme/tokens';

type NotificationCategoryTabsProps = {
  tabs: Array<{ key: string; label: string }>;
  activeKey: string;
  onChange: (key: string) => void;
};

export function NotificationCategoryTabs({
  tabs,
  activeKey,
  onChange,
}: NotificationCategoryTabsProps) {
  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => {
        const active = activeKey === tab.key;

        return (
          <InstantPressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.key}
            onPress={() => onChange(tab.key)}
            hapticFeedback="selection"
            style={[styles.tab, active ? styles.tabActive : null]}
          >
            <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</Text>
          </InstantPressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    maxHeight: 56,
    backgroundColor: colors.surface,
  },
  content: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: colors.surface,
  },
  tab: {
    alignSelf: 'center',
    height: minTouchSize,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabTextActive: {
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
