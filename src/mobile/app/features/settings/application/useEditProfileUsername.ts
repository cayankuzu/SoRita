import {
  availabilityHelperText,
  availabilityHelperTone,
} from '@/mobile/app/data/hooks/accountAvailabilityState';
import { useUsernameAvailabilityQuery } from '@/mobile/app/data/hooks/useAccountAvailabilityQuery';
import type { User } from '@/mobile/app/data/contracts/entities';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { normalizeUsernameInput } from '@/mobile/app/shared/validation/contentLimits';

/**
 * The username field of the profile editor: its normalized value, whether it
 * is free, and the helper line under it. The user's current username is
 * theirs, so it never goes to the server.
 */
export function useEditProfileUsername({
  active,
  currentUser,
  editUsername,
}: {
  active: boolean;
  currentUser: User | null | undefined;
  editUsername: string;
}) {
  const normalizedEditUsername = normalizeUsernameInput(editUsername).trim();
  const currentUsername = currentUser?.username.trim().toLowerCase() || '';
  const { availability } = useUsernameAvailabilityQuery({
    active: Boolean(currentUser) && active,
    availableMessage:
      normalizedEditUsername === currentUsername
        ? tr.settings.editProfile.helperSameUsername
        : tr.settings.editProfile.helperUsernameUsable,
    checkingMessage: tr.settings.editProfile.helperUsernameChecking,
    errorMessage: tr.settings.editProfile.helperUsernameError,
    excludeUserId: currentUser?.id,
    ownValue: currentUsername,
    invalidMessage: (value) =>
      value.length < 3 ? tr.settings.editProfile.helperUsernameTooShort : null,
    unavailableMessage: tr.settings.editProfile.helperUsernameTaken,
    value: editUsername,
  });

  return {
    normalizedEditUsername,
    usernameAvailability: availability,
    usernameHelper: availabilityHelperText(availability, tr.settings.editProfile.helperUsernameIdle),
    usernameHelperTone: availabilityHelperTone(availability),
  };
}
