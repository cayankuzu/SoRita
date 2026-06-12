import type { MapMarkerItem } from '@/mobile/app/shared/utils/format';

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
  highlightedIndex?: number | null;
  focusIndex?: number | null;
  focusTrigger?: number;
  viewport?: SharedMapViewport | null;
  showUserLocation?: boolean;
  onMapGesture?: () => void;
  onMarkerPress?: (index: number) => void;
  onPoiPress?: (poi: { lat: number; lng: number; name: string; placeId: string }) => void;
  onMapPress?: (coords: { lat: number; lng: number }) => void;
};
