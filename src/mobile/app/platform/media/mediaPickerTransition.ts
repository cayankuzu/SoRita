import { Platform } from 'react-native';

/**
 * iOS can only present one modal view controller at a time. Callers that keep
 * their own <Modal> mounted (e.g. PlaceEditorModal, ListEditorModal) must fully
 * hide it before another modal-based media flow (source prompt, custom gallery,
 * in-app camera) is presented — and must wait again after the media flow
 * resolves before re-showing themselves.
 *
 * Skipping this native transition window causes iOS to silently drop the next
 * presentation, which surfaces as the picker "not opening" (a stuck, blank
 * overlay).
 *
 * On Android this is a no-op.
 */
const IOS_MODAL_TRANSITION_DELAY_MS = 320;

export async function waitForMediaPickerTransition() {
  if (Platform.OS !== 'ios') {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, IOS_MODAL_TRANSITION_DELAY_MS);
  });
}
