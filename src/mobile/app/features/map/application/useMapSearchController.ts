import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import type {
  MapPlaceEntry,
  MapViewport,
  PanelData,
} from '@/mobile/app/features/map/application/mapScreenTypes';
import {
  findExistingPlaceMatch,
  LIVE_SEARCH_DEBOUNCE_MS,
  LIVE_SEARCH_MIN_LENGTH,
} from '@/mobile/app/features/map/application/mapScreenUtils';
import {
  searchPlacesByText,
  type GeocodingSearchResult,
} from '@/mobile/app/platform/api/geocoding';
import { getUserFacingErrorMessage } from '@/mobile/app/platform/feedback/errorMessage';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { tr } from '@/mobile/app/shared/i18n/tr';

type UseMapSearchControllerParams = {
  allPlaces: MapPlaceEntry[];
  openEditorPanel: (data: PanelData) => void;
  openExistingPlacePanel: (target: { place: Place; list: PlaceList }) => void;
  setManualViewport: Dispatch<SetStateAction<MapViewport | null>>;
  selectedSearchResult: GeocodingSearchResult | null;
  setSelectedSearchResult: Dispatch<SetStateAction<GeocodingSearchResult | null>>;
};

export function useMapSearchController({
  allPlaces,
  openEditorPanel,
  openExistingPlacePanel,
  setManualViewport,
  selectedSearchResult,
  setSelectedSearchResult,
}: UseMapSearchControllerParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingSearchResult[]>([]);
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const searchRequestIdRef = useRef(0);
  const skipNextLiveSearchRef = useRef(false);

  const performSearch = useCallback(async (rawQuery: string, showErrorToast = false) => {
    const trimmedQuery = rawQuery.trim();

    if (trimmedQuery.length < LIVE_SEARCH_MIN_LENGTH) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchErrorMessage(null);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    try {
      setIsSearching(true);
      const results = await searchPlacesByText(trimmedQuery);

      if (searchRequestIdRef.current !== requestId) {
        return;
      }

      setSearchResults(results);
      setHasSearched(true);
      setSearchErrorMessage(null);
    } catch (error) {
      if (searchRequestIdRef.current !== requestId) {
        return;
      }

      setSearchResults([]);
      setHasSearched(true);
      const message = getUserFacingErrorMessage(
        error,
        tr.map.searchError,
      );
      setSearchErrorMessage(message);

      if (showErrorToast) {
        showToast(message, 'error');
      }
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setIsSearching(false);
      }
    }
  }, []);

  const runSearch = useCallback(() => {
    void performSearch(searchQuery, true);
  }, [performSearch, searchQuery]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (skipNextLiveSearchRef.current) {
      skipNextLiveSearchRef.current = false;
      return;
    }

    if (!trimmedQuery || trimmedQuery.length < LIVE_SEARCH_MIN_LENGTH) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchErrorMessage(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      void performSearch(trimmedQuery);
    }, LIVE_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [performSearch, searchQuery]);

  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setSearchErrorMessage(null);

      if (!value.trim() || (selectedSearchResult && value.trim() !== selectedSearchResult.name)) {
        setSelectedSearchResult(null);
      }
    },
    [selectedSearchResult],
  );

  const clearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setManualViewport(null);
    setSelectedSearchResult(null);
    setHasSearched(false);
    setIsSearching(false);
    setSearchErrorMessage(null);
  }, [setManualViewport, setSelectedSearchResult]);

  const handleSearchResultPress = useCallback(
    (item: GeocodingSearchResult) => {
      const matchedPlace = findExistingPlaceMatch(allPlaces, item.lat, item.lng, item.name);

      if (matchedPlace) {
        skipNextLiveSearchRef.current = true;
        setSearchResults([]);
        setHasSearched(false);
        setSearchQuery(item.name);
        openExistingPlacePanel(matchedPlace);
        return;
      }

      skipNextLiveSearchRef.current = true;
      setManualViewport({
        latitude: item.lat,
        longitude: item.lng,
        zoom: 14.5,
      });
      setSearchFocusTrigger((current) => current + 1);
      setSelectedSearchResult(item);
      setSearchResults([]);
      setHasSearched(false);
      setSearchQuery(item.name);
      openEditorPanel({
        lat: item.lat,
        lng: item.lng,
        name: item.name,
        address: item.address,
      });
    },
    [allPlaces, openEditorPanel, openExistingPlacePanel, setManualViewport],
  );

  return {
    clearSearch,
    handleSearchQueryChange,
    handleSearchResultPress,
    hasSearched,
    isSearching,
    runSearch,
    searchErrorMessage,
    searchFocusTrigger,
    searchQuery,
    searchResults,
  };
}
