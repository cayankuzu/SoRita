import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronUp, LocateFixed, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useMapScreenState } from '@/mobile/app/features/map/application/useMapScreenState';
import {
  MapAddHint,
  MapPriorityNotice,
  MapVisibilityLegend,
} from '@/mobile/app/features/map/ui/components/MapScreenOverlays';
import { hasSeenMapAddHint, markMapAddHintSeen } from '@/mobile/app/platform/storage/uiHints';
import { AppMapView } from '@/mobile/app/shared/components/maps/AppMapView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';
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

export function MapScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState(false);
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
  const locateButtonBottomOffset = Math.max(insets.bottom, 8) + 8;
  const searchLayerTopOffset = Platform.OS === 'ios' ? 10 : 12;
  const markerFilterOptions = React.useMemo(
    () => [
      { value: 'all', label: tr.map.filterAll, color: colors.textSoft },
      { value: 'public', label: tr.map.filterPublic, color: colors.visibilityPublic },
      { value: 'private', label: tr.map.filterPrivate, color: colors.visibilityPrivate },
      { value: 'mixed', label: tr.map.filterMixed, color: colors.visibilityMixed },
      { value: 'none', label: tr.map.filterNone, color: colors.textSoft },
    ] as const,
    [],
  );
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
        <View style={styles.container}>
          <View style={[styles.searchLayer, { top: searchLayerTopOffset }]} pointerEvents="box-none">
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
                  <Pressable
                    accessibilityLabel={tr.common.close}
                    accessibilityRole="button"
                    onPress={clearSearch}
                    style={styles.clearButton}
                  >
                    <X color={colors.textSoft} size={14} />
                  </Pressable>
                ) : null}
              </View>
              </View>
              <View style={styles.searchActionGroup}>
                <Pressable
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
                </Pressable>
                <Pressable
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
                </Pressable>
              </View>
            </View>

            {isFilterMenuOpen ? (
              <View style={styles.filterMenu}>
                <Text style={styles.filterMenuTitle}>{tr.map.filterTitle}</Text>
                {markerFilterOptions.map((option) => {
                  const isActive = markerFilter === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        styles.filterOption,
                        isActive ? styles.filterOptionActive : null,
                      ]}
                      onPress={() => {
                        setMarkerFilter(option.value);
                        setIsFilterMenuOpen(false);
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
                      <Text
                        style={[
                          styles.filterOptionText,
                          isActive ? styles.filterOptionTextActive : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {searchResults.length > 0 ? (
              <View style={styles.resultsCard}>
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
                    <Pressable
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
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : hasSearched && !isSearching ? (
              <View style={styles.emptyResultsCard}>
                <Text style={styles.emptyResultsTitle}>{tr.map.noResultsTitle}</Text>
                <Text style={styles.emptyResultsDescription}>{tr.map.noResultsDescription}</Text>
              </View>
            ) : null}
          </View>

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

          {showMapAddHint && !editorData && !minimizedEditor ? (
            <MapAddHint bottom={locateButtonBottomOffset + 8} onClose={dismissMapAddHint} />
          ) : null}

          <Pressable
            accessibilityLabel={tr.map.locateMe}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLocating }}
            disabled={isLocating}
            style={[
              styles.locateButton,
              isLocating ? styles.locateButtonDisabled : null,
              { bottom: locateButtonBottomOffset },
            ]}
            onPress={() => {
              void handleLocateUser();
            }}
          >
            {isLocating ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <LocateFixed color={colors.text} size={18} />
            )}
          </Pressable>

          {minimizedEditor ? (
            <Pressable
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
            </Pressable>
          ) : null}

          {!minimizedEditor && minimizedExistingPlace ? (
            <Pressable
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
            </Pressable>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    gap: 6,
    elevation: 8,
    paddingHorizontal: 10,
  },
  searchControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 44,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    height: 34,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
    backgroundColor: 'transparent',
    includeFontPadding: false,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  clearButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchActionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  floatingSearchAction: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    elevation: 4,
  },
  refreshButtonActive: {
    backgroundColor: colors.primaryBg,
  },
  filterButtonActive: {
    backgroundColor: colors.primaryBg,
  },
  filterMenu: {
    width: 190,
    alignSelf: 'flex-end',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 8,
    gap: 4,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  filterMenuTitle: {
    paddingHorizontal: 4,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  filterOption: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterOptionActive: {
    backgroundColor: colors.surfaceMuted,
  },
  filterOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterOptionDotNone: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.textSoft,
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterOptionTextActive: {
    color: colors.text,
  },
  resultsCard: {
    maxHeight: 324,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    elevation: 6,
  },
  resultsScroll: {
    flexGrow: 0,
  },
  resultsScrollContent: {
    paddingBottom: 4,
  },
  resultsHeader: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  resultsHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  resultRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  resultAddress: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  emptyResultsCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyResultsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  emptyResultsDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
  map: {
    flex: 1,
    backgroundColor: colors.mapBackground,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.mapBackground,
  },
  locateButton: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  locateButtonDisabled: {
    opacity: 0.72,
  },
  reopenEditorButton: {
    position: 'absolute',
    left: 12,
    right: 60,
    minHeight: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  reopenEditorBody: {
    flex: 1,
    gap: 2,
  },
  reopenEditorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  reopenEditorSubtitle: {
    ...typography.metadataText,
    color: colors.onDarkSubtle,
  },
});
