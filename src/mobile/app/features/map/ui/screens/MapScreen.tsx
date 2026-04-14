import React from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronUp, LocateFixed, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { useMapScreenState } from '@/mobile/app/features/map/application/useMapScreenState';
import { PlaceEditorModal } from '@/mobile/app/features/map/ui/components/PlaceEditorModal';
import { PlacePreviewModal } from '@/mobile/app/features/map/ui/components/PlacePreviewModal';
import { AppMapView } from '@/mobile/app/shared/components/maps/AppMapView';
import { ExpandableText } from '@/mobile/app/shared/components/ui/ExpandableText';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';

export function MapScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
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
    hasSearched,
    isSearching,
    lists,
    mapPlaces,
    minimizedEditor,
    minimizeEditor,
    onRefresh,
    refreshing,
    reopenMinimizedEditor,
    runSearch,
    searchFocusTrigger,
    searchQuery,
    searchResults,
    selectedExistingEntry,
    selectedSearchMarkerIndex,
  } = useMapScreenState({ user });
  const locateButtonBottomOffset = 24 + (typeof bottomTabBarHeight === 'number' ? 0 : insets.bottom);

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
          <View style={styles.searchLayer}>
            <View style={styles.searchBar}>
              <View style={styles.searchInputWrap}>
                <Search color={colors.textSoft} size={16} />
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearchQueryChange}
                  placeholder={tr.map.searchPlaceholder}
                  placeholderTextColor={colors.textSoft}
                  style={styles.searchInput}
                  returnKeyType="search"
                  onSubmitEditing={runSearch}
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
              <Pressable style={styles.searchButton} onPress={runSearch}>
                <Text style={styles.searchButtonText}>{tr.map.searchButton}</Text>
              </Pressable>
            </View>

            {searchResults.length > 0 ? (
              <View style={styles.resultsCard}>
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsHeaderText}>{`${searchResults.length} öneri`}</Text>
                </View>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.placeId}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.resultRow}
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
                  )}
                />
              </View>
            ) : hasSearched && !isSearching ? (
              <View style={styles.emptyResultsCard}>
                <Text style={styles.emptyResultsTitle}>Sonuç bulunamadı</Text>
                <Text style={styles.emptyResultsDescription}>Farklı bir arama terimi deneyin.</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.map}>
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
          </View>

          <Pressable
            style={[styles.locateButton, { bottom: locateButtonBottomOffset }]}
            onPress={() => {
              void handleLocateUser();
            }}
          >
            <LocateFixed color={colors.text} size={20} />
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
    elevation: 3,
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
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
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
  searchButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  resultsCard: {
    maxHeight: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
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
