import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { ChevronUp, LocateFixed, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react-native';

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
import { hasSeenMapAddHint, markMapAddHintSeen } from '@/mobile/app/platform/storage/uiHints';
import { env } from '@/mobile/app/platform/config/env';
import { AppMapView } from '@/mobile/app/shared/components/maps/AppMapView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, hitSlopFor } from '@/mobile/app/shared/theme/tokens';
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
    <View style={styles.filterMenu}>
      <Text style={styles.filterMenuTitle}>{tr.map.filterTitle}</Text>
      {MARKER_FILTER_OPTIONS.map((option) => {
        const isActive = markerFilter === option.value;

        return (
          <InstantPressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
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
            <Text style={[styles.filterOptionText, isActive ? styles.filterOptionTextActive : null]}>
              {option.label}
            </Text>
          </InstantPressable>
        );
      })}
    </View>
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
                <Search color={colors.textSoft} size={16} />
                <TextInput
                  accessibilityLabel={tr.map.searchPlaceholder}
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
                    accessibilityLabel={tr.common.close}
                    accessibilityRole="button"
                    onPress={clearSearch}
                    hitSlop={hitSlopFor(24)}
                    style={styles.clearButton}
                  >
                    <X color={colors.textSoft} size={14} />
                  </InstantPressable>
                ) : null}
              </View>
              </View>
              <View style={styles.searchActionGroup}>
                <InstantPressable
                  accessibilityLabel={tr.map.refreshButton}
                  accessibilityRole="button"
                  disabled={refreshing}
                  style={[styles.floatingSearchAction, refreshing ? styles.refreshButtonActive : null]}
                  onPress={handleRefreshPress}
                >
                  {refreshing ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <RefreshCw color={colors.textMuted} size={16} />
                  )}
                </InstantPressable>
                <InstantPressable
                  accessibilityLabel={tr.map.filterButton}
                  accessibilityRole="button"
                  style={[
                    styles.floatingSearchAction,
                    markerFilter !== 'all' ? styles.filterButtonActive : null,
                  ]}
                  onPress={() => setIsFilterMenuOpen((current) => !current)}
                >
                  <SlidersHorizontal
                    color={markerFilter !== 'all' ? colors.primary : colors.textMuted}
                    size={16}
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
            <View
              pointerEvents="box-none"
              style={[
                styles.resultsLayer,
                mapOverlayLayout.isShort ? styles.resultsLayerShort : null,
                mapOverlayLayout.resultsTop == null ? null : { top: mapOverlayLayout.resultsTop },
                mapOverlayLayout.resultsBottom == null
                  ? null
                  : { bottom: mapOverlayLayout.resultsBottom },
              ]}
            >
              {searchResults.length > 0 ? (
                <View style={[styles.resultsCard, { maxHeight: mapOverlayLayout.resultsMaxHeight }]}>
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsHeaderText}>
                      {tr.map.searchResultCount(searchResults.length)}
                    </Text>
                  </View>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={styles.resultsScroll}
                    contentContainerStyle={styles.resultsScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {searchResults.map((item, index) => (
                      <InstantPressable
                        accessibilityLabel={`${item.name}. ${item.address}`}
                        accessibilityRole="button"
                        key={item.placeId}
                        style={[
                          styles.resultRow,
                          index === searchResults.length - 1 ? styles.resultRowLast : null,
                        ]}
                        onPress={() => handleSearchResultPress(item)}
                      >
                        <ExpandableText
                          text={item.name}
                          collapsedLines={1}
                          textStyle={styles.resultTitle}
                          showIndicator={false}
                        />
                        <ExpandableText
                          text={item.address}
                          collapsedLines={2}
                          textStyle={styles.resultAddress}
                          showIndicator={false}
                        />
                      </InstantPressable>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.emptyResultsCard}>
                  <Text style={styles.emptyResultsTitle}>{tr.map.noResultsTitle}</Text>
                  <Text style={styles.emptyResultsDescription}>{tr.map.noResultsDescription}</Text>
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.map}>
            {isFocused ? (
              <AppMapView
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
              />
            ) : (
              <View style={styles.mapPlaceholder} />
            )}
          </View>

          <MapVisibilityLegend bottom={locateButtonBottomOffset + 58} />

          {showMapAddHint && !editorData && !minimizedEditor && !minimizedExistingPlace ? (
            <MapAddHint bottom={locateButtonBottomOffset + 8} onClose={dismissMapAddHint} />
          ) : null}

          <InstantPressable
            accessibilityLabel={tr.map.locateMe}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLocating }}
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
              <LocateFixed color={colors.text} size={18} />
            )}
          </InstantPressable>

          {minimizedEditor ? (
            <InstantPressable
              accessibilityLabel={tr.map.reopenPanel}
              accessibilityRole="button"
              style={[styles.reopenEditorButton, { bottom: locateButtonBottomOffset }]}
              onPress={reopenMinimizedEditor}
            >
              <View style={styles.reopenEditorBody}>
                <ExpandableText
                  text={minimizedEditor.panel.name || tr.placeEditor.minimizedNewTitle}
                  collapsedLines={1}
                  textStyle={styles.reopenEditorTitle}
                  showIndicator={false}
                />
                <Text style={styles.reopenEditorSubtitle}>
                  {isEditorInteractionLocked ? tr.placeEditor.saveProgressTitle : tr.map.reopenPanel}
                </Text>
              </View>
              <ChevronUp color={colors.onPrimary} size={16} />
            </InstantPressable>
          ) : null}

          {!minimizedEditor && minimizedExistingPlace ? (
            <InstantPressable
              accessibilityLabel={tr.map.reopenPreview}
              accessibilityRole="button"
              style={[styles.reopenEditorButton, { bottom: locateButtonBottomOffset }]}
              onPress={reopenMinimizedExistingPlace}
            >
              <View style={styles.reopenEditorBody}>
                <ExpandableText
                  text={tr.map.placeCardLabel}
                  collapsedLines={1}
                  textStyle={styles.reopenEditorTitle}
                  showIndicator={false}
                />
                <Text style={styles.reopenEditorSubtitle}>{tr.map.reopenPreview}</Text>
              </View>
              <ChevronUp color={colors.onPrimary} size={16} />
            </InstantPressable>
          ) : null}
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
