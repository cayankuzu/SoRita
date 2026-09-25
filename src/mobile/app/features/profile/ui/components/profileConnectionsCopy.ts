import { tr } from '@/mobile/app/shared/i18n/tr';

export type ProfileConnectionMode = 'followers' | 'following';

// The followers and following lists open the same modal with their own words.
export function profileConnectionsCopy(mode: ProfileConnectionMode) {
  return mode === 'followers'
    ? { emptyTitle: tr.profile.connections.emptyFollowers, title: tr.profile.connections.followers }
    : { emptyTitle: tr.profile.connections.emptyFollowing, title: tr.profile.connections.following };
}
