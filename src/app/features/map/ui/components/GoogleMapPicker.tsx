import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import type { Place } from '@/app/data/contracts/entities';
import { MapPin, X, Search, LocateFixed } from 'lucide-react';

interface SearchResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
  category?: string;
}

interface GoogleMapPickerProps {
  places: Place[];
  onPlaceClick?: (place: Place) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onPlaceSelect?: (place: {
    name: string;
    lat: number;
    lng: number;
    address?: string;
    placeId?: string;
  }) => void;
}

function createCircleIcon(color: string, size: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function GoogleMapPicker({ places, onPlaceClick, onMapClick, onPlaceSelect }: GoogleMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const searchMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [resultCount, setResultCount] = useState<number | null>(null);

  const onMapClickRef = useRef(onMapClick);
  const onPlaceClickRef = useRef(onPlaceClick);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onPlaceClickRef.current = onPlaceClick; }, [onPlaceClick]);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [39.9334, 32.8597],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update place markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    places.forEach((place) => {
      const marker = L.marker([place.lat, place.lng], {
        icon: createCircleIcon('#3b82f6', 20),
        title: place.name,
      }).addTo(mapRef.current!);
      marker.on('click', () => onPlaceClickRef.current?.(place));
      markersRef.current.push(marker);
    });
  }, [places]);

  // Nominatim autocomplete (typing)
  const performAutocomplete = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); setShowResults(false); return; }
    setIsLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&accept-language=tr&countrycodes=tr`,
        { headers: { 'User-Agent': 'SoRita-App/1.0' } }
      );
      const data = await res.json();
      const results: SearchResult[] = data.map((item: any) => {
        const parts = (item.display_name || '').split(',');
        return {
          placeId: String(item.place_id),
          name: parts[0]?.trim() || query,
          address: parts.slice(1, 4).map((p: string) => p.trim()).join(', '),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          category: item.class,
        };
      });
      setSearchResults(results);
      setShowResults(results.length > 0);
    } catch { setSearchResults([]); setShowResults(false); }
    setIsLoading(false);
  }, []);

  // Overpass API full search (submit) — finds ALL matching POIs in Turkey
  const performFullSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setShowResults(false);
    setResultCount(null);

    // Clear previous search markers
    searchMarkersRef.current.forEach(m => m.remove());
    searchMarkersRef.current = [];

    try {
      // Use Overpass to find all nodes/ways matching the name in Turkey
      const overpassQuery = `
        [out:json][timeout:15];
        area["ISO3166-1"="TR"]->.turkey;
        (
          node["name"~"${query}",i](area.turkey);
          way["name"~"${query}",i](area.turkey);
        );
        out center 100;
      `;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json();
      const elements = data.elements || [];

      if (elements.length === 0) {
        // Fallback to Nominatim
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=50&addressdetails=1&accept-language=tr&countrycodes=tr`,
          { headers: { 'User-Agent': 'SoRita-App/1.0' } }
        );
        const nomData = await nomRes.json();
        const results: SearchResult[] = nomData.map((item: any) => {
          const parts = (item.display_name || '').split(',');
          return {
            placeId: String(item.place_id),
            name: parts[0]?.trim() || query,
            address: parts.slice(1, 4).map((p: string) => p.trim()).join(', '),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          };
        });
        pinResultsOnMap(results);
        setResultCount(results.length);
      } else {
        const results: SearchResult[] = elements
          .filter((el: any) => (el.lat && el.lon) || (el.center?.lat && el.center?.lon))
          .map((el: any) => ({
            placeId: String(el.id),
            name: el.tags?.name || query,
            address: [el.tags?.['addr:street'], el.tags?.['addr:city']].filter(Boolean).join(', ') || '',
            lat: el.lat || el.center?.lat,
            lng: el.lon || el.center?.lon,
          }));
        pinResultsOnMap(results);
        setResultCount(results.length);
      }
    } catch {
      // Final fallback
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=50&addressdetails=1&accept-language=tr&countrycodes=tr`,
          { headers: { 'User-Agent': 'SoRita-App/1.0' } }
        );
        const data = await res.json();
        const results: SearchResult[] = data.map((item: any) => {
          const parts = (item.display_name || '').split(',');
          return {
            placeId: String(item.place_id),
            name: parts[0]?.trim() || query,
            address: parts.slice(1, 4).map((p: string) => p.trim()).join(', '),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          };
        });
        pinResultsOnMap(results);
        setResultCount(results.length);
      } catch {
        setResultCount(0);
      }
    }
    setIsLoading(false);
  }, []);

  const handleInputChange = useCallback((query: string) => {
    setSearchQuery(query);
    setResultCount(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(() => performAutocomplete(query), 350);
  }, [performAutocomplete]);

  // Pin results on map
  const pinResultsOnMap = useCallback((results: SearchResult[]) => {
    if (!mapRef.current || results.length === 0) return;

    searchMarkersRef.current.forEach(m => m.remove());
    searchMarkersRef.current = [];

    const bounds = L.latLngBounds([]);

    results.forEach((result) => {
      const marker = L.marker([result.lat, result.lng], {
        icon: createCircleIcon('#10b981', 20),
        title: result.name,
      }).addTo(mapRef.current!);

      marker.bindPopup(
        `<div style="font-family:inherit;"><strong style="font-size:13px;">${result.name}</strong>${result.address ? `<br/><span style="font-size:11px;color:#666;">${result.address}</span>` : ''}</div>`,
        { closeButton: false, maxWidth: 200 }
      );

      marker.on('click', () => {
        onPlaceSelectRef.current?.({
          name: result.name,
          lat: result.lat,
          lng: result.lng,
          address: result.address,
          placeId: result.placeId,
        });
      });

      searchMarkersRef.current.push(marker);
      bounds.extend([result.lat, result.lng]);
    });

    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, []);

  // Submit handler
  const handleSubmit = useCallback(() => {
    if (!searchQuery.trim()) return;
    setShowResults(false);
    performFullSearch(searchQuery);
  }, [searchQuery, performFullSearch]);

  // Select single result from dropdown
  const handleSelectResult = useCallback((result: SearchResult) => {
    setSearchQuery(result.name);
    setShowResults(false);
    setResultCount(null);

    if (mapRef.current) {
      searchMarkersRef.current.forEach(m => m.remove());
      searchMarkersRef.current = [];

      mapRef.current.flyTo([result.lat, result.lng], 16, { duration: 0.8 });

      const marker = L.marker([result.lat, result.lng], {
        icon: createCircleIcon('#10b981', 24),
      }).addTo(mapRef.current);
      searchMarkersRef.current.push(marker);
    }

    onPlaceSelectRef.current?.({
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      address: result.address,
      placeId: result.placeId,
    });
  }, []);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.flyTo([latitude, longitude], 15, { duration: 0.8 });

        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.25),0 2px 6px rgba(0,0,0,0.3);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        }).addTo(mapRef.current!);

        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setResultCount(null);
    searchMarkersRef.current.forEach(m => m.remove());
    searchMarkersRef.current = [];
  }, []);

  const getCategoryIcon = (type?: string, category?: string) => {
    if (category === 'amenity' && (type === 'cafe' || type === 'restaurant')) return '🍽️';
    if (category === 'tourism') return '🏛️';
    if (category === 'shop') return '🛍️';
    if (category === 'leisure' || type === 'park') return '🌳';
    if (type === 'hotel' || type === 'hostel') return '🏨';
    return null;
  };

  return (
    <div className="relative w-full h-full">
      {/* Search bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000]">
        <div className="relative">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
            className="flex items-center bg-white/95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden"
          >
            <div className="pl-3 text-gray-400">
              <Search className="size-[18px]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0 && !resultCount) setShowResults(true);
              }}
              placeholder="Mekan, adres veya şehir ara..."
              className="flex-1 px-3 py-3 text-sm bg-transparent outline-none placeholder-gray-400"
            />
            {isLoading && (
              <div className="pr-2">
                <div className="size-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {searchQuery && !isLoading && (
              <button type="button" onClick={clearSearch} className="pr-2 text-gray-400 active:text-gray-600">
                <X className="size-4" />
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-3 bg-blue-500 text-white text-sm active:bg-blue-600 transition-colors"
              style={{ fontWeight: 500 }}
            >
              Ara
            </button>
          </form>

          {/* Result count badge after submit */}
          {resultCount !== null && !showResults && (
            <div className="mt-2 flex justify-center">
              <span className="bg-green-500 text-white text-xs px-3 py-1.5 rounded-full shadow-sm" style={{ fontWeight: 500 }}>
                {resultCount > 0 ? `${resultCount} mekan bulundu` : 'Sonuç bulunamadı'}
              </span>
            </div>
          )}

          {/* Autocomplete dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs text-gray-500">{searchResults.length} öneri</p>
              </div>
              {searchResults.map((result, idx) => {
                const emoji = getCategoryIcon(result.type, result.category);
                return (
                  <button
                    key={result.placeId || idx}
                    className="w-full text-left px-4 py-3 active:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0 flex items-start gap-3"
                    onClick={() => handleSelectResult(result)}
                  >
                    <div className="mt-0.5 shrink-0">
                      {emoji ? (
                        <span className="text-base">{emoji}</span>
                      ) : (
                        <MapPin className="size-4 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate" style={{ fontWeight: 500 }}>{result.name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{result.address}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* No autocomplete results */}
          {showResults && searchResults.length === 0 && !isLoading && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg p-4 text-center">
              <p className="text-sm text-gray-500">Sonuç bulunamadı</p>
              <p className="text-xs text-gray-400 mt-1">Farklı bir arama terimi deneyin</p>
            </div>
          )}
        </div>
      </div>

      {/* My location button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleLocateMe(); }}
        disabled={isLocating}
        className="absolute bottom-6 right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-full shadow-lg p-3 active:scale-95 transition-transform"
      >
        <LocateFixed className={`size-5 ${isLocating ? 'text-blue-500 animate-pulse' : 'text-gray-600'}`} />
      </button>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
