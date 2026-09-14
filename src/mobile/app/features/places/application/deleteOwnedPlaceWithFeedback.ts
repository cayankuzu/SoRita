import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';

type DeleteOwnedPlaceParams = {
  deletePlace: (placeId: string) => Promise<void>;
  onDeleted: () => void;
  placeId: string;
};

export async function deleteOwnedPlaceWithFeedback({
  deletePlace,
  onDeleted,
  placeId,
}: DeleteOwnedPlaceParams) {
  try {
    await deletePlace(placeId);
    onDeleted();
    showToast(tr.profile.toast.placeDeleted, 'success');
  } catch (error) {
    const message = getUserFacingErrorMessage(error, tr.map.deletePlaceUnexpected);
    showToast(message, 'error');
    const propagatedError = new Error(message);
    (propagatedError as Error & { cause?: unknown }).cause = error;
    throw propagatedError;
  }
}
