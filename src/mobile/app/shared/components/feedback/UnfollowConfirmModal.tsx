import React from 'react';

import { ConfirmActionModal } from '@/mobile/app/shared/components/feedback/ConfirmActionModal';
import { tr } from '@/mobile/app/shared/i18n/tr';

type UnfollowTarget = {
  isPrivateAccount: boolean;
  username: string;
};

type UnfollowConfirmModalProps = {
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  // Null keeps the dialog closed.
  target: UnfollowTarget | null;
};

// Unfollowing asks first, wherever it starts (a profile, an Explore tile): a
// private account takes a new request to see again.
export function UnfollowConfirmModal({ onClose, onConfirm, target }: UnfollowConfirmModalProps) {
  return (
    <ConfirmActionModal
      visible={Boolean(target)}
      title={tr.profile.actions.unfollowConfirmTitle(target?.username ?? '')}
      description={
        target?.isPrivateAccount
          ? tr.profile.actions.unfollowConfirmPrivate
          : tr.profile.actions.unfollowConfirmPublic
      }
      confirmLabel={tr.profile.actions.unfollow}
      confirmVariant="danger"
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
