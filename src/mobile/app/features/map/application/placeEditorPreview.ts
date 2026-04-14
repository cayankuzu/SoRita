import { PLACE_DIETARY_OPTIONS } from '@/mobile/app/catalog/placeOptions';
import type { Place } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { formatPrice } from '@/mobile/app/shared/utils/format';

type PlaceEditorSnapshot = {
  existingPlace?: Place | null;
  name: string;
  title: string;
  lat: number;
  lng: number;
  address: string;
  placeAddress?: string;
  notes: string;
  rating: number;
  selectedCategories: string[];
  studentFriendly: boolean;
  priceMin: string;
  priceMax: string;
  bestTimes: string[];
  atmosphere: string[];
  features: string[];
  photos: string[];
  placeName?: string;
};

type PlaceEditorDraftSnapshot = {
  step: number;
  name: string;
  title: string;
  address: string;
  notes: string;
  selectedCategories: string[];
  rating: number;
  studentFriendly: boolean;
  priceMin: string;
  priceMax: string;
  selectedLists: string[];
  photos: string[];
  bestTimes: string[];
  atmosphere: string[];
  features: string[];
  newListName: string;
  newListDescription: string;
  newListCoverImage: string;
  newListPublic: boolean;
  showNewListForm: boolean;
};

export function buildPreviewPlace({
  existingPlace,
  name,
  title,
  lat,
  lng,
  address,
  placeAddress,
  notes,
  rating,
  selectedCategories,
  studentFriendly,
  priceMin,
  priceMax,
  bestTimes,
  atmosphere,
  features,
  photos,
  placeName,
}: PlaceEditorSnapshot): Place {
  return {
    id: existingPlace?.id || 'preview-place',
    name: name.trim() || placeName || tr.placeEditor.placeNamePlaceholder,
    title: title.trim() || undefined,
    lat,
    lng,
    address: address.trim() || placeAddress || undefined,
    notes: notes.trim() || undefined,
    rating,
    category: selectedCategories[0] || 'other',
    categories: selectedCategories.length > 0 ? selectedCategories : ['other'],
    studentDiscount: studentFriendly,
    priceRange: priceMin || priceMax ? 2 : undefined,
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
    bestTime: bestTimes[0],
    bestTimes,
    atmosphere,
    specialFeatures: features,
    photos,
    addedAt: existingPlace?.addedAt || new Date().toISOString(),
    addedBy: existingPlace?.addedBy,
  };
}

export function buildPreviewCategories(previewPlace: Place) {
  if (previewPlace.categories?.length) {
    return previewPlace.categories;
  }

  return previewPlace.category ? [previewPlace.category] : [];
}

export function buildPreviewBestTimes(previewPlace: Place) {
  if (previewPlace.bestTimes?.length) {
    return previewPlace.bestTimes;
  }

  return previewPlace.bestTime ? [previewPlace.bestTime] : [];
}

export function buildPreviewDietaryOptions(previewPlace: Place) {
  return Array.from(
    new Set((previewPlace.specialFeatures || []).filter((item) => PLACE_DIETARY_OPTIONS.includes(item))),
  );
}

export function buildPreviewGeneralFeatures(previewPlace: Place) {
  return Array.from(
    new Set((previewPlace.specialFeatures || []).filter((item) => !PLACE_DIETARY_OPTIONS.includes(item))),
  );
}

export function buildPreviewPriceLabel(previewPlace: Place) {
  return formatPrice(previewPlace);
}

export function buildPlaceEditorDraft(snapshot: PlaceEditorDraftSnapshot): PlaceEditorDraft {
  return { ...snapshot };
}

export function buildPlaceSavePayload(snapshot: PlaceEditorSnapshot): Omit<Place, 'id' | 'addedAt'> {
  return {
    name: snapshot.name.trim(),
    title: snapshot.title.trim() || undefined,
    lat: snapshot.lat,
    lng: snapshot.lng,
    address: snapshot.address.trim() || undefined,
    notes: snapshot.notes.trim() || undefined,
    rating: snapshot.rating,
    category: snapshot.selectedCategories[0] || 'other',
    categories: snapshot.selectedCategories.length > 0 ? snapshot.selectedCategories : ['other'],
    studentDiscount: snapshot.studentFriendly,
    priceRange: snapshot.priceMin || snapshot.priceMax ? 2 : undefined,
    priceMin: snapshot.priceMin ? Number(snapshot.priceMin) : undefined,
    priceMax: snapshot.priceMax ? Number(snapshot.priceMax) : undefined,
    bestTime: snapshot.bestTimes[0],
    bestTimes: snapshot.bestTimes,
    atmosphere: snapshot.atmosphere,
    specialFeatures: snapshot.features,
    photos: snapshot.photos,
    addedBy: snapshot.existingPlace?.addedBy,
  };
}
