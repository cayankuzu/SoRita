import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Copy, Flag, Pencil, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useModalAccessibilityFocus } from '@/mobile/app/shared/hooks/useModalAccessibilityFocus';
import { useModalAnimationType } from '@/mobile/app/shared/hooks/useModalAnimationType';
import {
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import {
  getAndroidModalWindowProps,
  getModalSafeAreaPadding,
} from '@/mobile/app/shared/utils/modalLayout';

type CommentActionSheetProps = {
  comment: FeedActionComment | null;
  editingCommentId?: string | null;
  onClose: () => void;
  onCopy: (comment: FeedActionComment) => void;
  onDelete: (comment: FeedActionComment) => void;
  onEdit: (comment: FeedActionComment) => void;
  onReport: (comment: FeedActionComment) => void;
};

type ActionOption = {
  icon: React.ReactNode;
  key: string;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'default';
};

function ActionRow({
  icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  tone?: 'danger' | 'default';
}) {
  return (
    <InstantPressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.actionRow, tone === 'danger' ? styles.actionRowDanger : null]}
    >
      <View style={styles.actionRowIcon}>{icon}</View>
      <AppText style={[styles.actionRowLabel, tone === 'danger' ? styles.actionRowLabelDanger : null]}>
        {label}
      </AppText>
    </InstantPressable>
  );
}

export function CommentActionSheet({
  comment,
  editingCommentId = null,
  onClose,
  onCopy,
  onDelete,
  onEdit,
  onReport,
}: CommentActionSheetProps) {
  const animationType = useModalAnimationType('slide');
  useModalAccessibilityFocus({ accessibilityLabel: tr.cards.commentActionsTitle, visible: Boolean(comment) });
  const insets = useSafeAreaInsets();
  const { paddingTop, paddingBottom } = getModalSafeAreaPadding({
    topInset: insets.top,
    bottomInset: insets.bottom,
    topSpacing: 20,
    bottomSpacing: 12,
    minBottomPadding: Platform.OS === 'android' ? 28 : 16,
  });
  const isEditing = Boolean(comment && editingCommentId === comment.id);
  const options: ActionOption[] = comment
    ? [
        ...(comment.content.trim()
          ? [
              {
                icon: <Copy color={colors.textSoft} size={iconSize.sm} />,
                key: 'copy',
                label: tr.cards.copy,
                onPress: () => onCopy(comment),
              } satisfies ActionOption,
            ]
          : []),
        ...(comment.canEdit
          ? [
              {
                icon: <Pencil color={isEditing ? colors.primary : colors.textSoft} size={iconSize.sm} />,
                key: 'edit',
                label: tr.cards.editComment,
                onPress: () => onEdit(comment),
              } satisfies ActionOption,
            ]
          : []),
        ...(comment.canReport
          ? [
              {
                icon: <Flag color={colors.warning} size={iconSize.sm} />,
                key: 'report',
                label: tr.cards.report,
                onPress: () => onReport(comment),
              } satisfies ActionOption,
            ]
          : []),
        ...(comment.canDelete
          ? [
              {
                icon: <Trash2 color={colors.danger} size={iconSize.sm} />,
                key: 'delete',
                label: tr.common.delete,
                onPress: () => onDelete(comment),
                tone: 'danger',
              } satisfies ActionOption,
            ]
          : []),
      ]
    : [];

  return (
    <Modal
      {...getAndroidModalWindowProps({
        navigationBarTranslucent: true,
        statusBarTranslucent: true,
      })}
      visible={Boolean(comment)}
      transparent
      animationType={animationType}
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View
        accessibilityViewIsModal
        importantForAccessibility="yes"
        onAccessibilityEscape={onClose}
        style={[styles.overlay, { paddingTop, paddingBottom }]}
      >
        <InstantPressable
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText accessibilityRole="header" style={styles.title}>
                {tr.cards.commentActionsTitle}
              </AppText>
              {comment ? <AppText style={styles.subtitle}>{comment.userName}</AppText> : null}
            </View>
            <IconButton
              accessibilityLabel={tr.common.close}
              onPress={onClose}
              variant="surface"
            >
              <X color={colors.textSoft} size={iconSize.sm} />
            </IconButton>
          </View>

          <View style={styles.options}>
            {options.map((option) => (
              <ActionRow
                key={option.key}
                icon={option.icon}
                label={option.label}
                onPress={option.onPress}
                tone={option.tone}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    width: '100%',
    maxWidth: 648,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: textStyle('compactTitleText', colors.text),
  subtitle: textStyle('compactBodyText', colors.textSoft),
  options: {
    gap: spacing.sm,
  },
  actionRow: {
    minHeight: minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionRowDanger: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
  },
  actionRowIcon: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRowLabel: {
    flex: 1,
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  actionRowLabelDanger: {
    color: colors.danger,
  },
});
