import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export type SettingsMenuItem = {
  label: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
  danger?: boolean;
};

type SettingsMenuSectionProps = {
  title: string;
  items: SettingsMenuItem[];
};

export function SettingsMenuSection({ title, items }: SettingsMenuSectionProps) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.menuGroup}>
        {items.map((item, index) => (
          <InstantPressable
            key={item.label}
            onPress={item.action}
            style={[styles.menuRow, index < items.length - 1 ? styles.menuRowBorder : null]}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color }]}>{item.icon}</View>
            <Text style={[styles.menuLabel, item.danger ? styles.menuLabelDanger : null]}>{item.label}</Text>
            <ChevronRight color={colors.textSoft} size={18} />
          </InstantPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginBottom: 8,
    paddingHorizontal: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  menuGroup: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  menuRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  menuLabelDanger: {
    color: colors.danger,
  },
});
