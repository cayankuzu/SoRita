import type { MapMarkerItem } from '@/mobile/app/shared/utils/markerColors';

export type SharedMapViewport = {
  latitude: number;
  longitude: number;
  zoom?: number;
};

export type SharedMapProps = {
  places: MapMarkerItem[];
  instanceId?: number;
  interactive?: boolean;
  liteMode?: boolean;
  // Hides businesses and transit icons for a preview; the main map keeps them
  // because people pick where to add a place by the businesses they see.
  quietBasemap?: boolean;
  highlightedIndex?: number | null;
  focusIndex?: number | null;
  focusTrigger?: number;
  focusBehavior?: 'zoom' | 'center' | 'none';
  viewport?: SharedMapViewport | null;
  showUserLocation?: boolean;
  onMapGesture?: () => void;
  onMarkerPress?: (index: number) => void;
  onPoiPress?: (poi: { lat: number; lng: number; name: string; placeId: string }) => void;
  onMapPress?: (coords: { lat: number; lng: number }) => void;
};
