import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  minTouchSize,
  radius,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

type NotificationCategoryTabsProps = {
  tabs: Array<{ key: string; label: string }>;
  activeKey: string;
  onChange: (key: string) => void;
  resultCount?: number;
};

export function NotificationCategoryTabs({
  tabs,
  activeKey,
  onChange,
  resultCount,
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
            accessibilityLabel={
              active && typeof resultCount === 'number'
                ? `${tab.label}, ${tr.notifications.resultCount(resultCount)}`
                : tab.label
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.key}
            onPress={() => onChange(tab.key)}
            hapticFeedback="selection"
            style={[styles.tab, active ? styles.tabActive : null]}
          >
            <AppText style={[styles.tabText, active ? styles.tabTextActive : null]}>{tab.label}</AppText>
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
  tabText: textStyle('supportingLabelText', colors.textMuted),
  tabTextActive: {
    fontWeight: fontWeight.strong,
    color: colors.onPrimary,
  },
});
