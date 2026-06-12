import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronUp, LocateFixed, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useMapScreenState } from '@/mobile/app/features/map/application/useMapScreenState';
import { PlaceEditorModal } from '@/mobile/app/features/map/ui/components/PlaceEditorModal';
import { PlacePreviewModal } from '@/mobile/app/features/map/ui/components/PlacePreviewModal';
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
  const bottomTabBarHeight = React.useContext(BottomTabBarHeightContext);
  const {
    activeEditorMarkerIndex,
    clearSearch,
    closeEditor,
    closeSelectedExistingPlace,
    createList,
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
    isSearching,
    isLocating,
    lists,
    locationErrorMessage,
    locationPermissionDenied,
    mapPlaces,
    minimizedEditor,
    minimizeEditor,
    onRefresh,
    refreshing,
    reopenMinimizedEditor,
    retryLists,
    retryLocation,
    runSearch,
    searchErrorMessage,
    searchFocusTrigger,
    searchQuery,
    searchResults,
    selectedExistingEntry,
    selectedSearchMarkerIndex,
    visibleDataErrorMessage,
  } = useMapScreenState({ user });
  const locateButtonBottomOffset =
    24 + (typeof bottomTabBarHeight === 'number' ? bottomTabBarHeight : insets.bottom);

  return (
    <>
      <Screen
        padded={false}
        scroll={false}
        safeTop={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <View style={styles.container}>
          <View style={styles.searchLayer} pointerEvents="box-none">
            {visibleDataErrorMessage ? (
              <InlineNotice
                tone={hasMapDataPartialError ? 'warning' : 'danger'}
                title={
                  hasMapDataPartialError
                    ? 'Kayitli harita verileri gosteriliyor'
                    : 'Harita verileri guncellenemedi'
                }
                description={visibleDataErrorMessage}
                actionLabel="Tekrar dene"
                onAction={() => {
                  void retryLists();
                }}
              />
            ) : null}

            {searchErrorMessage ? (
              <InlineNotice
                tone="warning"
                title="Arama su an tamamlanamiyor"
                description={searchErrorMessage}
                actionLabel="Aramayi yinele"
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
                    ? 'Konum izni gerekli'
                    : 'Konum su an alinamiyor'
                }
                description={locationErrorMessage}
                actionLabel={locationPermissionDenied ? 'Izni tekrar iste' : 'Tekrar dene'}
                onAction={() => {
                  void retryLocation();
                }}
              />
            ) : null}

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
                  onSubmitEditing={() => {
                    void runSearch();
                  }}
                />
                {isSearching ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : searchQuery ? (
                  <Pressable
                    onPress={clearSearch}
                    style={styles.clearButton}
                  >
                    <X color={colors.textSoft} size={16} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                accessibilityState={{ disabled: isSearching || searchQuery.trim().length < 2 }}
                disabled={isSearching || searchQuery.trim().length < 2}
                style={[
                  styles.searchButton,
                  isSearching || searchQuery.trim().length < 2 ? styles.searchButtonDisabled : null,
                ]}
                onPress={() => {
                  void runSearch();
                }}
              >
                <Text style={styles.searchButtonText}>{tr.map.searchButton}</Text>
              </Pressable>
            </View>

            {searchResults.length > 0 ? (
              <View style={styles.resultsCard}>
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsHeaderText}>{`${searchResults.length} öneri`}</Text>
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
                <Text style={styles.emptyResultsTitle}>Sonuç bulunamadı</Text>
                <Text style={styles.emptyResultsDescription}>Farklı bir arama terimi deneyin.</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.map}>
            {isFocused ? (
              <AppMapView
                places={mapPlaces}
                interactive
                showUserLocation
                viewport={effectiveViewport}
                highlightedIndex={activeEditorMarkerIndex}
                focusIndex={activeEditorMarkerIndex ?? selectedSearchMarkerIndex}
                focusTrigger={activeEditorMarkerIndex != null ? editorFocusTrigger : searchFocusTrigger}
                onMapPress={handleMapPress}
                onPoiPress={handlePoiPress}
                onMarkerPress={handleMarkerPress}
              />
            ) : (
              <View style={styles.mapPlaceholder} />
            )}
          </View>

          <Pressable
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
                <Text style={styles.reopenEditorSubtitle}>Paneli yeniden ac</Text>
              </View>
              <ChevronUp color={colors.onPrimary} size={18} />
            </Pressable>
          ) : null}
        </View>
      </Screen>

      <PlacePreviewModal
        visible={Boolean(selectedExistingEntry)}
        place={selectedExistingEntry?.place || null}
        list={selectedExistingEntry?.list || null}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onClose={closeSelectedExistingPlace}
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
        lists={lists}
        draft={editorDraft}
        onClose={closeEditor}
        onMinimize={minimizeEditor}
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
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    gap: 8,
    elevation: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    minHeight: 36,
    height: 36,
    fontSize: 14,
    lineHeight: 18,
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
  searchButton: {
    minWidth: 56,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
  },
  searchButtonDisabled: {
    opacity: 0.55,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
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
    backgroundColor: '#ebe7de',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#ebe7de',
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
    shadowColor: '#0f172a',
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
    color: 'rgba(255,255,255,0.72)',
  },
});
