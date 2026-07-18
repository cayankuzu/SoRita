import React from 'react';
import { Ban, Flag } from 'lucide-react-native';

import {
  ActionMenuSheet,
  type ActionMenuSheetItem,
} from '@/mobile/app/shared/components/feedback/ActionMenuSheet';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

type UserProfileActionsSheetProps = {
  visible: boolean;
  isBlockedByCurrent: boolean;
  onClose: () => void;
  onOpenBlockConfirm: () => void;
  onOpenReport: () => void;
  onUnblock: () => void;
};

export function UserProfileActionsSheet({
  visible,
  isBlockedByCurrent,
  onClose,
  onOpenBlockConfirm,
  onOpenReport,
  onUnblock,
}: UserProfileActionsSheetProps) {
  const items = React.useMemo<readonly ActionMenuSheetItem[]>(
    () =>
      isBlockedByCurrent
        ? [
            {
              key: 'unblock',
              label: tr.profile.actions.unblock,
              renderIcon: () => <Ban color={colors.secondary} size={16} />,
              onPress: onUnblock,
            },
          ]
        : [
            {
              key: 'report',
              label: tr.profile.actions.report,
              renderIcon: () => <Flag color={colors.warning} size={16} />,
              onPress: onOpenReport,
            },
            {
              key: 'block',
              label: tr.profile.userActions.blockConfirmLabel,
              tone: 'danger',
              renderIcon: () => <Ban color={colors.danger} size={16} />,
              onPress: onOpenBlockConfirm,
            },
          ],
    [isBlockedByCurrent, onOpenBlockConfirm, onOpenReport, onUnblock],
  );

  return (
    <ActionMenuSheet
      visible={visible}
      title={tr.profile.actions.menuTitle}
      items={items}
      onClose={onClose}
    />
  );
}
