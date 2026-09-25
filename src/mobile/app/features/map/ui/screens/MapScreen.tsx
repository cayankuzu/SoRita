import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { LocateFixed, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import type { MarkerFilterOption } from '@/mobile/app/contracts/mapScreenState';
import { getMapOverlayLayout } from '@/mobile/app/features/map/application/mapScreenUtils';
import { useMapScreenState } from '@/mobile/app/features/map/application/useMapScreenState';
import { mapScreenStyles as styles } from '@/mobile/app/features/map/ui/screens/mapScreenStyles';
import {
  MapAddHint,
  MapPriorityNotice,
  MapVisibilityLegend,
} from '@/mobile/app/features/map/ui/components/MapScreenOverlays';
import {
  MapReopenPill,
  MapSearchResults,
} from '@/mobile/app/features/map/ui/components/MapScreenControls';
import { hasSeenMapAddHint, markMapAddHintSeen } from '@/mobile/app/platform/storage/uiHints';
import { env } from '@/mobile/app/platform/config/env';
import { GoogleMapView } from '@/mobile/app/shared/components/maps/GoogleMapView';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { useAndroidBackHandler } from '@/mobile/app/shared/hooks/useAndroidBackHandler';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, hitSlopFor, iconSize } from '@/mobile/app/shared/theme/tokens';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';

type PlaceEditorModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/map/ui/components/PlaceEditorModal')['PlaceEditorModal']
>;
type PlacePreviewModalProps = React.ComponentProps<
  typeof import('@/mobile/app/features/map/ui/components/PlacePreviewModal')['PlacePreviewModal']
>;

function DeferredPlaceEditorModal(props: PlaceEditorModalProps) {
  const { PlaceEditorModal } = require('@/mobile/app/features/map/ui/components/PlaceEditorModal') as
    typeof import('@/mobile/app/features/map/ui/components/PlaceEditorModal');
  return <PlaceEditorModal {...props} />;
}

function DeferredPlacePreviewModal(props: PlacePreviewModalProps) {
  const { PlacePreviewModal } = require('@/mobile/app/features/map/ui/components/PlacePreviewModal') as
    typeof import('@/mobile/app/features/map/ui/components/PlacePreviewModal');
  return <PlacePreviewModal {...props} />;
}

const MARKER_FILTER_OPTIONS = [
  { value: 'all', label: tr.map.filterAll, color: colors.textSoft },
  { value: 'public', label: tr.map.filterPublic, color: colors.visibilityPublic },
  { value: 'private', label: tr.map.filterPrivate, color: colors.visibilityPrivate },
  { value: 'mixed', label: tr.map.filterMixed, color: colors.visibilityMixed },
  { value: 'none', label: tr.map.filterNone, color: colors.textSoft },
] as const;

function MapFilterMenu({
  markerFilter,
  onClose,
  onFilterChange,
}: {
  markerFilter: MarkerFilterOption;
  onClose: () => void;
  onFilterChange: (filter: MarkerFilterOption) => void;
}) {
  return (
    <View
      accessibilityLabel={tr.map.filterTitle}
      accessibilityRole="radiogroup"
      style={styles.filterMenu}
    >
      <AppText style={styles.filterMenuTitle}>{tr.map.filterTitle}</AppText>
      {MARKER_FILTER_OPTIONS.map((option) => {
        const isActive = markerFilter === option.value;

        return (
          <InstantPressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            hitSlop={hitSlopFor(44)}
            key={option.value}
            style={[styles.filterOption, isActive ? styles.filterOptionActive : null]}
            onPress={() => {
              onFilterChange(option.value);
              onClose();
            }}
          >
            <View
              style={[
                styles.filterOptionDot,
                option.value === 'none'
                  ? styles.filterOptionDotNone
                  : { backgroundColor: option.color },
              ]}
            />
            <AppText style={[styles.filterOptionText, isActive ? styles.filterOptionTextActive : null]}>
              {option.label}
            </AppText>
          </InstantPressable>
        );
      })}
    </View>
  );
}

// The bottom row of controls over the map: a 44dp button and a little air.
const MAP_CONTROL_ROW_HEIGHT = 52;

function MapSecondaryOverlays({
  bottom,
  hasEditor,
  hasPriorityNotice,
  hasMinimizedEditor,
  hasMinimizedExistingPlace,
  isShort,
  onDismissHint,
  showHint,
}: {
  bottom: number;
  hasEditor: boolean;
  hasPriorityNotice: boolean;
  hasMinimizedEditor: boolean;
  hasMinimizedExistingPlace: boolean;
  isShort: boolean;
  onDismissHint: () => void;
  showHint: boolean;
}) {
  if (isShort) {
    return null;
  }

  return (
    <>
      <MapVisibilityLegend bottom={bottom + 58} />
      {showHint &&
      !hasPriorityNotice &&
      !hasEditor &&
      !hasMinimizedEditor &&
      !hasMinimizedExistingPlace ? (
        <MapAddHint bottom={bottom + 8} onClose={onDismissHint} />
      ) : null}
    </>
  );
}

export function MapScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState(false);
  const [mapSceneHeight, setMapSceneHeight] = React.useState(0);
  const [searchChromeHeight, setSearchChromeHeight] = React.useState(0);
  const [showMapAddHint, setShowMapAddHint] = React.useState(false);
  const {
    activeEditorMarkerIndex,
    clearSearch,
    closeEditor,
    closeSelectedExistingPlace,
    createPlaceCardForSelectedLocation,
    createList,
    beginEditorSave,
    editorData,
    editorDraft,
    editorFocusTrigger,
    effectiveViewport,
    handleDeletePlace,
    handleLocateUser,
    handleMapCenterChange,
    handleMapPress,
    handleMarkerPress,
    handlePoiPress,
    handleSavePlace,
    handleSearchQueryChange,
    handleSearchResultPress,
    hasMapDataPartialError,
    hasSearched,
    isEditorInteractionLocked,
    isSearching,
    isLocating,
    isMapInitialLoading,
    lists,
    locationErrorMessage,
    locationPermissionDenied,
    locationPermissionCanAskAgain,
    markerFilter,
    mapPlaces,
    minimizedEditor,
    minimizedExistingPlace,
    minimizeEditor,
    minimizeSelectedExistingPlace,
    onRefresh,
    refreshing,
    reopenMinimizedExistingPlace,
    reopenMinimizedEditor,
    retryLists,
    retryLocation,
    runSearch,
    searchErrorMessage,
    searchFocusTrigger,
    searchQuery,
    searchResults,
    selectedExistingEntries,
    selectedExistingMarkerColor,
    selectedSearchMarkerIndex,
    setMarkerFilter,
    unlockEditorAfterSaveFailure,
    visibleDataErrorMessage,
  } = useMapScreenState({ user });
  useScreenPerformanceMetric({
    hasContent: mapPlaces.length > 0,
    hasError: Boolean(visibleDataErrorMessage),
    isLoading: isMapInitialLoading,
    screen: 'map',
  });
  const mapOverlayLayout = React.useMemo(
    () => getMapOverlayLayout(mapSceneHeight, searchChromeHeight),
    [mapSceneHeight, searchChromeHeight],
  );
  const locateButtonBottomOffset = mapOverlayLayout.controlBottom;
  const searchLayerTopOffset = Platform.select({
    ios: mapOverlayLayout.searchTop,
    android: 12,
    default: 12,
  });
  const hasPriorityNotice = Boolean(
    visibleDataErrorMessage || searchErrorMessage || locationErrorMessage || env.isExpoGo,
  );
  const showSearchFeedback = !isFilterMenuOpen && !hasPriorityNotice && !isSearching && hasSearched;
  // Back closes what is open over the map before it leaves the tab: it used
  // to switch to the previous tab and leave the pin menu open for the return.
  useAndroidBackHandler(isFilterMenuOpen || showSearchFeedback, () => {
    if (isFilterMenuOpen) {
      setIsFilterMenuOpen(false);
    } else {
      clearSearch();
    }
  });
  const activeFilterLabel = MARKER_FILTER_OPTIONS.find(
    (option) => option.value === markerFilter,
  )?.label;
  const handleMapSceneLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setMapSceneHeight((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
  }, []);
  const handleSearchChromeLayout = React.useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setSearchChromeHeight((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
  }, []);
  React.useEffect(() => {
    let cancelled = false;

    if (isFocused) {
      void hasSeenMapAddHint().then((seen) => {
        if (!cancelled && !seen) {
          setShowMapAddHint(true);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [isFocused]);
  const dismissMapAddHint = React.useCallback(() => {
    setShowMapAddHint(false);
    void markMapAddHintSeen();
  }, []);
  const handleInteractiveMapPress = React.useCallback(
    (coords: { lat: number; lng: number }) => {
      setIsFilterMenuOpen(false);
      dismissMapAddHint();
      void handleMapPress(coords);
    },
    [dismissMapAddHint, handleMapPress],
  );
  const handleInteractiveMarkerPress = React.useCallback(
    (index: number) => {
      setIsFilterMenuOpen(false);
      handleMarkerPress(index);
    },
    [handleMarkerPress],
  );
  const handleInteractivePoiPress = React.useCallback(
    (poi: { lat: number; lng: number; name: string; placeId: string }) => {
      setIsFilterMenuOpen(false);
      void handlePoiPress(poi);
    },
    [handlePoiPress],
  );
  const handleRefreshPress = React.useCallback(() => {
    setIsFilterMenuOpen(false);
    void onRefresh();
  }, [onRefresh]);

  return (
    <>
      <Screen padded={false} scroll={false} safeTop={false}>
        <View style={styles.container} onLayout={handleMapSceneLayout}>
          <View
            style={[styles.searchLayer, { top: searchLayerTopOffset }]}
            pointerEvents="box-none"
            onLayout={handleSearchChromeLayout}
          >
            <MapPriorityNotice
              hasMapDataPartialError={hasMapDataPartialError}
              locationErrorMessage={locationErrorMessage}
              locationPermissionCanAskAgain={locationPermissionCanAskAgain}
              locationPermissionDenied={locationPermissionDenied}
              onRetryLists={() => void retryLists()}
              onRetryLocation={() => void retryLocation()}
              onRetrySearch={() => void runSearch()}
              searchErrorMessage={searchErrorMessage}
              visibleDataErrorMessage={visibleDataErrorMessage}
            />

            <View style={styles.searchControlsRow}>
              <View
                style={styles.searchBar}
                collapsable={false}
                needsOffscreenAlphaCompositing
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
              >
              <View style={styles.searchInputWrap}>
                <Search color={colors.textSoft} size={iconSize.sm} />
                <TextInput
                  accessibilityLabel={tr.map.searchPlaceholder}
                  accessibilityState={{ busy: isSearching }}
                  value={searchQuery}
                  onChangeText={handleSearchQueryChange}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  cursorColor={colors.primary}
                  importantForAutofill="no"
                  keyboardAppearance="light"
                  placeholder={tr.map.searchPlaceholder}
                  placeholderTextColor={colors.textSoft}
                  selectionColor={colors.primary}
                  spellCheck={false}
                  style={styles.searchInput}
                  textContentType="none"
                  returnKeyType="search"
                  underlineColorAndroid="transparent"
                  onFocus={() => {
                    setIsFilterMenuOpen(false);
                  }}
                  onSubmitEditing={() => {
                    void runSearch();
                  }}
                />
                {isSearching ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : searchQuery ? (
                  <InstantPressable
                    accessibilityLabel={tr.map.clearSearch}
                    accessibilityRole="button"
                    onPress={clearSearch}
                    hitSlop={hitSlopFor(24)}
                    style={styles.clearButton}
                  >
                    <X color={colors.textSoft} size={iconSize.sm} />
                  </InstantPressable>
                ) : null}
              </View>
              </View>
              <View style={styles.searchActionGroup}>
                <InstantPressable
                  accessibilityLabel={tr.map.refreshButton}
                  accessibilityRole="button"
                  accessibilityState={{ busy: refreshing, disabled: refreshing }}
                  hitSlop={hitSlopFor(44)}
                  disabled={refreshing}
                  style={[styles.floatingSearchAction, refreshing ? styles.refreshButtonActive : null]}
                  onPress={handleRefreshPress}
                >
                  {refreshing ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <RefreshCw color={colors.textMuted} size={iconSize.sm} />
                  )}
                </InstantPressable>
                <InstantPressable
                  accessibilityLabel={`${tr.map.filterButton}: ${activeFilterLabel || tr.map.filterAll}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded: isFilterMenuOpen,
                    selected: markerFilter !== 'all',
                  }}
                  hitSlop={hitSlopFor(44)}
                  style={[
                    styles.floatingSearchAction,
                    markerFilter !== 'all' ? styles.filterButtonActive : null,
                  ]}
                  onPress={() => setIsFilterMenuOpen((current) => !current)}
                >
                  <SlidersHorizontal
                    color={markerFilter !== 'all' ? colors.primary : colors.textMuted}
                    size={iconSize.sm}
                  />
                </InstantPressable>
              </View>
            </View>

            {isFilterMenuOpen ? (
              <MapFilterMenu
                markerFilter={markerFilter}
                onClose={() => setIsFilterMenuOpen(false)}
                onFilterChange={setMarkerFilter}
              />
            ) : null}

          </View>

          {showSearchFeedback ? (
            <MapSearchResults
              layout={mapOverlayLayout}
              onResultPress={handleSearchResultPress}
              results={searchResults}
            />
          ) : null}

          <View style={styles.map}>
            {isFocused ? (
              <GoogleMapView
                places={mapPlaces}
                interactive
                showUserLocation
                focusBehavior="none"
                viewport={effectiveViewport}
                highlightedIndex={activeEditorMarkerIndex}
                focusIndex={activeEditorMarkerIndex ?? selectedSearchMarkerIndex}
                focusTrigger={activeEditorMarkerIndex != null ? editorFocusTrigger : searchFocusTrigger}
                onMapPress={handleInteractiveMapPress}
                onPoiPress={handleInteractivePoiPress}
                onMarkerPress={handleInteractiveMarkerPress}
                onCenterChange={handleMapCenterChange}
                // The locate button, the reopen pill and the first-run hint
                // share the bottom row; Google's logo sits above it.
                bottomPadding={locateButtonBottomOffset + MAP_CONTROL_ROW_HEIGHT}
              />
            ) : (
              <View style={styles.mapPlaceholder} />
            )}
          </View>

          <MapSecondaryOverlays
            bottom={locateButtonBottomOffset}
            hasEditor={Boolean(editorData)}
            hasPriorityNotice={hasPriorityNotice}
            hasMinimizedEditor={Boolean(minimizedEditor)}
            hasMinimizedExistingPlace={Boolean(minimizedExistingPlace)}
            isShort={mapOverlayLayout.isShort}
            onDismissHint={dismissMapAddHint}
            showHint={showMapAddHint}
          />

          <InstantPressable
            accessibilityLabel={tr.map.locateMe}
            accessibilityRole="button"
            accessibilityState={{ busy: isLocating, disabled: isLocating }}
            hitSlop={hitSlopFor(44)}
            disabled={isLocating}
            style={[
              styles.locateButton,
              isLocating ? styles.locateButtonDisabled : null,
              { bottom: locateButtonBottomOffset },
            ]}
            onPress={handleLocateUser}
          >
            {isLocating ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <LocateFixed color={colors.text} size={iconSize.md} />
            )}
          </InstantPressable>

          <MapReopenPill
            bottom={locateButtonBottomOffset}
            editor={minimizedEditor}
            hasMinimizedPlace={Boolean(minimizedExistingPlace)}
            isSaving={isEditorInteractionLocked}
            onReopenEditor={reopenMinimizedEditor}
            onReopenPlace={reopenMinimizedExistingPlace}
          />
        </View>
      </Screen>

      {selectedExistingEntries.length > 0 ? (
        <DeferredPlacePreviewModal
          visible
          entries={selectedExistingEntries}
          markerColor={selectedExistingMarkerColor}
          onRefresh={onRefresh}
          onClose={closeSelectedExistingPlace}
          onCreatePlaceCard={createPlaceCardForSelectedLocation}
          onMinimize={minimizeSelectedExistingPlace}
          onOpenList={(list, placeId) => {
            closeSelectedExistingPlace();
            openStackScreen(navigation, 'ListDetail', { listId: list.id, placeId });
          }}
        />
      ) : null}

      {editorData ? (
        <DeferredPlaceEditorModal
          visible
          lat={editorData.lat}
          lng={editorData.lng}
          placeName={editorData.name}
          placeAddress={editorData.address}
          existingPlace={editorData.existingPlace}
          existingPlaceListName={editorData.existingPlaceListName}
          isInteractionLocked={isEditorInteractionLocked}
          lists={lists}
          draft={editorDraft}
          onClose={closeEditor}
          onMinimize={minimizeEditor}
          onSaveError={unlockEditorAfterSaveFailure}
          onSaveStart={beginEditorSave}
          onSave={handleSavePlace}
          onDelete={handleDeletePlace}
          onCreateList={createList}
        />
      ) : null}
    </>
  );
}
