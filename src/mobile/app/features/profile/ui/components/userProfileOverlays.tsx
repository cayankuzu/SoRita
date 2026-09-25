import React from 'react';

// Another person's profile: the connections list, the full-screen feed and
// the actions sheet, loaded when first opened.

type ProfileConnectionsModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/profile/ui/components/ProfileConnectionsModal')['ProfileConnectionsModal']
>;
type PlaceFeedScreenProps = React.ComponentProps<
  typeof import('@/mobile/app/features/places/public/feed')['PlaceFeedScreen']
>;
type UserProfileActionsSheetProps = React.ComponentProps<
  typeof import('@/mobile/app/features/profile/ui/components/UserProfileActionsSheet')['UserProfileActionsSheet']
>;

export function DeferredProfileConnectionsModal(props: ProfileConnectionsModalProps) {
  const { ProfileConnectionsModal } = require('@/mobile/app/features/profile/ui/components/ProfileConnectionsModal') as
    typeof import('@/mobile/app/features/profile/ui/components/ProfileConnectionsModal');
  return <ProfileConnectionsModal {...props} />;
}

export function DeferredPlaceFeedScreen(props: PlaceFeedScreenProps) {
  const { PlaceFeedScreen } = require('@/mobile/app/features/places/public/feed') as
    typeof import('@/mobile/app/features/places/public/feed');
  return <PlaceFeedScreen {...props} />;
}

export function DeferredUserProfileActionsSheet(props: UserProfileActionsSheetProps) {
  const { UserProfileActionsSheet } = require('@/mobile/app/features/profile/ui/components/UserProfileActionsSheet') as
    typeof import('@/mobile/app/features/profile/ui/components/UserProfileActionsSheet');
  return <UserProfileActionsSheet {...props} />;
}
