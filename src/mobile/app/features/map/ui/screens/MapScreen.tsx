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
import { PlaceEditorModal } from '@/mobile/app/features/map/ui/components/PlaceEditorModal';
import { PlacePreviewModal } from '@/mobile/app/features/map/ui/components/PlacePreviewModal';
import { env } from '@/mobile/app/platform/config/env';
import { AppMapView } from '@/mobile/app/shared/components/maps/AppMapView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export function MapScreen() {
  const navigation = useAppNavigation();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState(false);
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
    lists,
    locationErrorMessage,
    locationPermissionDenied,
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
  const locateButtonBottomOffset = Math.max(insets.bottom, 8) + 8;
  const searchLayerTopOffset = Platform.OS === 'ios' ? 10 : 12;
  const markerFilterOptions = React.useMemo(
    () => [
      { value: 'all', label: tr.map.filterAll, color: colors.textSoft },
      { value: 'public', label: tr.map.filterPublic, color: colors.secondary },
      { value: 'private', label: tr.map.filterPrivate, color: colors.danger },
      { value: 'mixed', label: tr.map.filterMixed, color: colors.primary },
      { value: 'none', label: tr.map.filterNone, color: colors.textSoft },
    ] as const,
    [],
  );
  const handleInteractiveMapPress = React.useCallback(
    (coords: { lat: number; lng: number }) => {
      setIsFilterMenuOpen(false);
      void handleMapPress(coords);
    },
    [handleMapPress],
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
            {visibleDataErrorMessage ? (
              <InlineNotice
                tone={hasMapDataPartialError ? 'warning' : 'danger'}
                title={
                  hasMapDataPartialError
                    ? tr.map.cachedDataTitle
                    : tr.map.dataErrorTitle
                }
                description={visibleDataErrorMessage}
                actionLabel={tr.common.retry}
                onAction={() => {
                  void retryLists();
                }}
              />
            ) : null}

            {searchErrorMessage ? (
              <InlineNotice
                tone="warning"
                title={tr.map.searchUnavailableTitle}
                description={searchErrorMessage}
                actionLabel={tr.map.searchRetry}
                onAction={() => {
                  void runSearch();
                }}
              />
            ) : null}

            {locationErrorMessage ? (
              <InlineNotice
                tone={locationPermissionDenied ? 'warning' : 'danger'}
                title={
                  locationPermissionDenied
                    ? tr.map.locationPermissionRequired
                    : tr.map.locationUnavailableTitle
                }
                description={locationErrorMessage}
                actionLabel={locationPermissionDenied ? tr.map.permissionRetry : tr.common.retry}
                onAction={() => {
                  void retryLocation();
                }}
              />
            ) : null}

            {env.isExpoGo ? (
              <InlineNotice
                tone="warning"
                title="Android Expo Go harita kısıtı"
                description="Bu emülatör şu an Expo Go ile açılıyor. Android native Google Maps, Expo Go paketinde gerekli yetkileri alamadığı için boş görünebilir. Gerçek SoRita geliştirici build'inde harita düzgün yüklenir."
              />
            ) : null}

            <View
              style={styles.searchBar}
              collapsable={false}
              needsOffscreenAlphaCompositing
              renderToHardwareTextureAndroid
              shouldRasterizeIOS
            >
              <Pressable
                accessibilityLabel={tr.map.refreshButton}
                accessibilityRole="button"
                disabled={refreshing}
                style={[
                  styles.refreshButton,
                  refreshing ? styles.refreshButtonActive : null,
                ]}
                onPress={handleRefreshPress}
              >
                {refreshing ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <RefreshCw color={colors.textMuted} size={18} />
                )}
              </Pressable>
              <View style={styles.searchBarDivider} />
              <View style={styles.searchInputWrap}>
                <Search color={colors.textSoft} size={18} />
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
                    <X color={colors.textSoft} size={16} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.searchBarDivider} />
              <Pressable
                accessibilityLabel={tr.map.filterButton}
                accessibilityRole="button"
                style={[
                  styles.filterButton,
                  markerFilter !== 'all' ? styles.filterButtonActive : null,
                ]}
                onPress={() => {
                  setIsFilterMenuOpen((current) => !current);
                }}
              >
                <SlidersHorizontal
                  color={markerFilter !== 'all' ? colors.primary : colors.textMuted}
                  size={18}
                />
              </Pressable>
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
              <LocateFixed color={colors.text} size={20} />
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
              <ChevronUp color={colors.onPrimary} size={18} />
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
              <ChevronUp color={colors.onPrimary} size={18} />
            </Pressable>
          ) : null}
        </View>
      </Screen>

      <PlacePreviewModal
        visible={selectedExistingEntries.length > 0}
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

      <PlaceEditorModal
        visible={Boolean(editorData)}
        lat={editorData?.lat || 0}
        lng={editorData?.lng || 0}
        placeName={editorData?.name}
        placeAddress={editorData?.address}
        existingPlace={editorData?.existingPlace}
        existingPlaceListName={editorData?.existingPlaceListName}
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
    gap: 8,
    elevation: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: 8,
    paddingRight: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 52,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    height: 40,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    backgroundColor: 'transparent',
    includeFontPadding: false,
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
  clearButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: colors.cardBorder,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  refreshButtonActive: {
    backgroundColor: colors.primaryBg,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  filterButtonActive: {
    backgroundColor: colors.primaryBg,
  },
  filterMenu: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
    gap: 4,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  filterMenuTitle: {
    paddingHorizontal: 6,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSoft,
  },
  filterOption: {
    minHeight: 42,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterOptionActive: {
    backgroundColor: colors.surfaceMuted,
  },
  filterOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  filterOptionDotNone: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.textSoft,
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterOptionTextActive: {
    color: colors.text,
  },
  resultsCard: {
    maxHeight: 360,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  resultAddress: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  emptyResultsCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  emptyResultsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emptyResultsDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
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
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
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
    left: 16,
    right: 76,
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
    fontSize: 13,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  reopenEditorSubtitle: {
    fontSize: 11,
    color: colors.onDarkSubtle,
  },
});
