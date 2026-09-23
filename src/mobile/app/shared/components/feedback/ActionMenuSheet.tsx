import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import { ModalScaffold } from '@/mobile/app/shared/components/feedback/ModalScaffold';
import { SheetHeader } from '@/mobile/app/shared/components/feedback/SheetHeader';
import { AppText, type AppTextRef } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import {
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  spacing,
  textStyle,
} from '@/mobile/app/shared/theme/tokens';

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
  // Whose content the actions apply to, such as a comment's author.
  subtitle?: string;
  items: readonly ActionMenuSheetItem[];
  onClose: () => void;
  returnFocusRef?: React.RefObject<unknown>;
};

export function ActionMenuSheet({
  visible,
  title,
  subtitle,
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
      contentContainerStyle={styles.sheetContent}
    >
      <SheetHeader onClose={onClose} subtitle={subtitle} title={title} titleRef={titleRef} />

      <View>
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
  sheetContent: {
    gap: spacing.sm,
  },
  // Plain rows, like the people lists: the icon and label carry the row, and
  // the press state marks it. Grey pill rows read as buttons stacked in a box.
  action: {
    minHeight: minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionIcon: {
    width: iconSize.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    ...textStyle('bodyText', colors.text, fontWeight.medium),
  },
  actionLabelDanger: {
    color: colors.danger,
  },
});
