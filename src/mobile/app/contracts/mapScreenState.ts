import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceEditorDraft } from '@/mobile/app/contracts/placeEditorDraft';
import type { GeocodingSearchResult } from '@/mobile/app/platform/api/geocoding';

export type PanelData = {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  existingPlace?: Place | null;
  existingPlaceListName?: string;
};

export type MarkerFilterOption = 'all' | 'public' | 'private' | 'mixed' | 'none';

export type MinimizedEditorState = {
  panel: PanelData;
  draft: PlaceEditorDraft;
};

export type ExistingPlaceSelection = {
  markerKey: string;
};

export type MinimizedPlacePreviewState = ExistingPlaceSelection;

export type MapViewport = {
  latitude: number;
  longitude: number;
  zoom?: number;
};

export type MapPlaceEntry = {
  place: Place;
  list: PlaceList;
};

export type PersistedMapScreenState = {
  editorData: PanelData | null;
  editorDraft: PlaceEditorDraft | null;
  manualViewport: MapViewport | null;
  markerFilter: MarkerFilterOption;
  minimizedEditor: MinimizedEditorState | null;
  minimizedExistingPlace: MinimizedPlacePreviewState | null;
  selectedExistingPlace: ExistingPlaceSelection | null;
  selectedSearchResult: GeocodingSearchResult | null;
  userViewport: MapViewport | null;
};
