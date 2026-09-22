import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';

import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { AppText, type AppTextRef } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import {
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  radius,
  spacing,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { tr } from '@/mobile/app/shared/i18n/tr';

export type ActionMenuSheetItem = {
  key: string;
  label: string;
  tone?: 'default' | 'danger';
  renderIcon?: (color: string) => React.ReactNode;
  onPress: () => Promise<void> | void;
};

type ActionMenuSheetProps = {
  visible: boolean;
  title: string;
  items: readonly ActionMenuSheetItem[];
  onClose: () => void;
  returnFocusRef?: React.RefObject<unknown>;
};

export function ActionMenuSheet({
  visible,
  title,
  items,
  onClose,
  returnFocusRef,
}: ActionMenuSheetProps) {
  const titleRef = React.useRef<AppTextRef | null>(null);

  return (
    <ModalScaffold
      accessibilityLabel={title}
      initialFocusRef={titleRef}
      visible={visible}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      variant="sheet"
      dismissOnBackdropPress
      style={styles.sheet}
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.header}>
        <AppText ref={titleRef} accessibilityRole="header" style={styles.title}>{title}</AppText>
        <IconButton accessibilityLabel={tr.common.close} onPress={onClose} variant="surface">
          <X color={colors.textMuted} size={iconSize.sm} />
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
              onPress={item.onPress}
              style={styles.action}
            >
              {item.renderIcon ? (
                <View style={styles.actionIcon}>{item.renderIcon(toneColor)}</View>
              ) : null}
              <AppText
                style={[
                  styles.actionLabel,
                  item.tone === 'danger' ? styles.actionLabelDanger : null,
                ]}
              >
                {item.label}
              </AppText>
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
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    ...typography.section,
    color: colors.text,
  },
  actions: {
    gap: spacing.sm,
  },
  action: {
    minHeight: minTouchSize,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionIcon: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    ...typography.bodyText,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
});
