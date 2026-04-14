import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';

interface MiniMapProps {
  places: { lat: number; lng: number; name: string; id?: string }[];
  className?: string;
  interactive?: boolean;
  onMarkerClick?: (placeIndex: number) => void;
  highlightIndex?: number | null;
}

export interface MiniMapHandle {
  panTo: (lat: number, lng: number) => void;
}

function createDot(color: string, size: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export const MiniMap = forwardRef<MiniMapHandle, MiniMapProps>(function MiniMap(
  { places, className = '', interactive = false, onMarkerClick, highlightIndex },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useImperativeHandle(ref, () => ({
    panTo(lat: number, lng: number) {
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 16);
      }
    },
  }));

  // Init + update
  useEffect(() => {
    if (!containerRef.current || places.length === 0) return;

    // Create map if not exists
    if (!mapRef.current) {
      const center: L.LatLngExpression = places.length === 1
        ? [places[0].lat, places[0].lng]
        : [
            places.reduce((s, p) => s + p.lat, 0) / places.length,
            places.reduce((s, p) => s + p.lng, 0) / places.length,
          ];

      mapRef.current = L.map(containerRef.current, {
        center,
        zoom: places.length === 1 ? 15 : 10,
        zoomControl: false,
        attributionControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);

    places.forEach((place, idx) => {
      const isHighlighted = highlightIndex === idx;
      const marker = L.marker([place.lat, place.lng], {
        icon: createDot(isHighlighted ? '#ef4444' : '#3b82f6', isHighlighted ? 18 : 12),
        title: place.name,
      }).addTo(mapRef.current!);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(idx));
      }

      markersRef.current.push(marker);
      bounds.extend([place.lat, place.lng]);
    });

    if (places.length === 1) {
      mapRef.current.setView([places[0].lat, places[0].lng], 15);
    } else if (places.length > 1) {
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }

    // Fix tile rendering
    setTimeout(() => mapRef.current?.invalidateSize(), 100);

    return () => {};
  }, [places, highlightIndex, interactive, onMarkerClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  if (places.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`rounded-xl overflow-hidden ${interactive ? '' : 'pointer-events-none'} ${className}`}
      style={{ minHeight: 120, position: 'relative', zIndex: 0, isolation: 'isolate' }}
    />
  );
});
