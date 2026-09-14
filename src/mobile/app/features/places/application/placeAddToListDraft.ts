import type { PlaceEditorDraft } from '@/mobile/app/contracts/placeEditorDraft';
import type { Place } from '@/mobile/app/data/contracts/entities';

const PLACE_EDITOR_LIST_SELECTION_STEP = 2;

function getInitialValues(values?: string[], fallback?: string) {
  return values?.length ? [...values] : fallback ? [fallback] : [];
}

/**
 * Starts the quote flow with the source card's editable metadata while keeping
 * it a new place. Source media is deliberately excluded: private storage URIs
 * are scoped to the original owner/list/place and cannot safely be persisted
 * under another list without a dedicated media-copy operation.
 */
export function buildPlaceAddToListDraft(place: Place): PlaceEditorDraft {
  return {
    step: PLACE_EDITOR_LIST_SELECTION_STEP,
    name: place.name,
    title: place.title || '',
    menuUrl: place.menuUrl || '',
    address: place.address || '',
    notes: place.notes || '',
    selectedCategories: getInitialValues(place.categories, place.category),
    rating: place.rating ?? 0,
    studentFriendly: Boolean(place.studentDiscount),
    priceMin: place.priceMin != null ? String(place.priceMin) : '',
    priceMax: place.priceMax != null ? String(place.priceMax) : '',
    selectedLists: [],
    media: [],
    photos: [],
    bestTimes: getInitialValues(place.bestTimes, place.bestTime),
    atmosphere: [...(place.atmosphere || [])],
    features: [...(place.specialFeatures || [])],
    newListName: '',
    newListDescription: '',
    newListCoverImage: '',
    newListPublic: false,
    showNewListForm: false,
  };
}
