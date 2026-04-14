import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors } from '@/mobile/app/shared/theme/tokens';

export type ProfileTabOption = {
  key: string;
  label: string;
  count?: number;
  renderIcon: (active: boolean) => React.ReactNode;
};

type ProfileTabsProps = {
  activeTab: string;
  onChange: (key: string) => void;
  tabs: ProfileTabOption[];
};

export function ProfileTabs({ activeTab, onChange, tabs }: ProfileTabsProps) {
  return (
    <View style={styles.wrap}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <InstantPressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.button, active ? styles.buttonActive : null]}
          >
            {tab.renderIcon(active)}
            <Text style={[styles.text, active ? styles.textActive : null]}>{tab.label}</Text>
            {typeof tab.count === 'number' ? (
              <View style={[styles.countBadge, active ? styles.countBadgeActive : null]}>
                <Text style={[styles.countText, active ? styles.countTextActive : null]}>{tab.count}</Text>
              </View>
            ) : null}
          </InstantPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  buttonActive: {
    borderBottomColor: colors.primary,
  },
  text: {
    fontSize: 13,
    color: colors.textSoft,
  },
  textActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 6,
  },
  countBadgeActive: {
    backgroundColor: colors.primaryBg,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  countTextActive: {
    color: colors.primary,
  },
});
