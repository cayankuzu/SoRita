import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';

export type PanelData = {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  existingPlace?: Place | null;
  existingPlaceListName?: string;
};

export type MinimizedEditorState = {
  panel: PanelData;
  draft: PlaceEditorDraft;
};

export type ExistingPlaceSelection = {
  listId: string;
  placeId: string;
};

export type MapViewport = {
  latitude: number;
  longitude: number;
  zoom?: number;
};

export type MapPlaceEntry = {
  place: Place;
  list: PlaceList;
};
