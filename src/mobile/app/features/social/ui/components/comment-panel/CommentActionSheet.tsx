import React from 'react';
import { Copy, Flag, Pencil, Trash2 } from 'lucide-react-native';

import type { FeedActionComment } from '@/mobile/app/features/social/ui/components/FeedActionTypes';
import {
  ActionMenuSheet,
  type ActionMenuSheetItem,
} from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

type CommentActionSheetProps = {
  comment: FeedActionComment | null;
  editingCommentId?: string | null;
  onClose: () => void;
  onCopy: (comment: FeedActionComment) => void;
  onDelete: (comment: FeedActionComment) => void;
  onEdit: (comment: FeedActionComment) => void;
  onReport: (comment: FeedActionComment) => void;
};

/**
 * A comment's actions in the same sheet every other menu uses: plain rows,
 * the destructive one in red. Its own boxed rows read as a different app.
 */
export function CommentActionSheet({
  comment,
  editingCommentId = null,
  onClose,
  onCopy,
  onDelete,
  onEdit,
  onReport,
}: CommentActionSheetProps) {
  const isEditing = Boolean(comment && editingCommentId === comment.id);
  const items: ActionMenuSheetItem[] = [];

  if (comment?.content.trim()) {
    items.push({
      key: 'copy',
      label: tr.cards.copy,
      onPress: () => onCopy(comment),
      renderIcon: (color) => <Copy color={color} size={iconSize.sm} />,
    });
  }
  if (comment?.canEdit) {
    items.push({
      key: 'edit',
      label: tr.cards.editComment,
      onPress: () => onEdit(comment),
      renderIcon: (color) => (
        <Pencil color={isEditing ? colors.primary : color} size={iconSize.sm} />
      ),
    });
  }
  if (comment?.canReport) {
    items.push({
      key: 'report',
      label: tr.cards.report,
      onPress: () => onReport(comment),
      renderIcon: (color) => <Flag color={color} size={iconSize.sm} />,
    });
  }
  if (comment?.canDelete) {
    items.push({
      key: 'delete',
      label: tr.common.delete,
      onPress: () => onDelete(comment),
      renderIcon: (color) => <Trash2 color={color} size={iconSize.sm} />,
      tone: 'danger',
    });
  }

  return (
    <ActionMenuSheet
      items={items}
      onClose={onClose}
      subtitle={comment?.userName}
      title={tr.cards.commentActionsTitle}
      visible={Boolean(comment)}
    />
  );
}
