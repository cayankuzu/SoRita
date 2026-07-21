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
          <X color={colors.textMuted} size={14} />
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
    maxWidth: 468,
  },
  sheetContent: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  actions: {
    gap: 8,
  },
  action: {
    minHeight: 44,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  actionIcon: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
});
