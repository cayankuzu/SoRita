import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

export type ActionMenuSheetItem = {
  key: string;
  label: string;
  tone?: 'default' | 'danger';
  renderIcon?: (color: string) => React.ReactNode;
  onPress: () => void;
};

type ActionMenuSheetProps = {
  visible: boolean;
  title: string;
  items: readonly ActionMenuSheetItem[];
  onClose: () => void;
};

export function ActionMenuSheet({
  visible,
  title,
  items,
  onClose,
}: ActionMenuSheetProps) {
  return (
    <ModalScaffold
      visible={visible}
      onClose={onClose}
      variant="sheet"
      dismissOnBackdropPress
      style={styles.sheet}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <IconButton accessibilityLabel={tr.common.close} onPress={onClose} variant="surface">
          <X color={colors.textMuted} size={16} />
        </IconButton>
      </View>

      <View style={styles.actions}>
        {items.map((item) => {
          const toneColor = item.tone === 'danger' ? colors.danger : colors.text;

          return (
            <InstantPressable
              accessibilityLabel={item.label}
              accessibilityRole="button"
              key={item.key}
              onPress={() => {
                item.onPress();
              }}
              style={styles.action}
            >
              {item.renderIcon ? (
                <View style={styles.actionIcon}>{item.renderIcon(toneColor)}</View>
              ) : null}
              <Text
                style={[
                  styles.actionLabel,
                  item.tone === 'danger' ? styles.actionLabelDanger : null,
                ]}
              >
                {item.label}
              </Text>
            </InstantPressable>
          );
        })}
      </View>
    </ModalScaffold>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxWidth: 520,
  },
  sheetContent: {
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  actions: {
    gap: 10,
  },
  action: {
    minHeight: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
});
