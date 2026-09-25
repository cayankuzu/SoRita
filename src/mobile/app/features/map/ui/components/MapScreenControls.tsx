import React from 'react';
import { ScrollView, View } from 'react-native';
import { ChevronUp } from 'lucide-react-native';

import type { MinimizedEditorState } from '@/mobile/app/contracts/mapScreenState';
import { mapScreenStyles as styles } from '@/mobile/app/features/map/ui/screens/mapScreenStyles';
import type { GeocodingSearchResult } from '@/mobile/app/platform/api/geocoding';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, hitSlopFor, iconSize } from '@/mobile/app/shared/theme/tokens';

type SearchResultsLayout = {
  isShort: boolean;
  resultsBottom?: number | null;
  resultsMaxHeight: number;
  resultsTop?: number | null;
};

// The search results under the search bar, or a note that nothing matched.
export function MapSearchResults({
  layout,
  onResultPress,
  results,
}: {
  layout: SearchResultsLayout;
  onResultPress: (result: GeocodingSearchResult) => void;
  results: GeocodingSearchResult[];
}) {
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.resultsLayer,
        layout.isShort ? styles.resultsLayerShort : null,
        layout.resultsTop == null ? null : { top: layout.resultsTop },
        layout.resultsBottom == null ? null : { bottom: layout.resultsBottom },
      ]}
    >
      {results.length > 0 ? (
        <View style={[styles.resultsCard, { maxHeight: layout.resultsMaxHeight }]}>
          <View style={styles.resultsHeader}>
            <AppText style={styles.resultsHeaderText}>
              {tr.map.searchResultCount(results.length)}
            </AppText>
          </View>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {results.map((item, index) => (
              <InstantPressable
                accessibilityLabel={`${item.name}. ${item.address}`}
                accessibilityRole="button"
                key={item.placeId}
                style={[styles.resultRow, index === results.length - 1 ? styles.resultRowLast : null]}
                onPress={() => onResultPress(item)}
              >
                <AppText numberOfLines={1} style={styles.resultTitle}>
                  {item.name}
                </AppText>
                {item.address ? (
                  <AppText numberOfLines={2} style={styles.resultAddress}>
                    {item.address}
                  </AppText>
                ) : null}
              </InstantPressable>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyResultsCard}>
          <AppText style={styles.emptyResultsTitle}>{tr.map.noResultsTitle}</AppText>
          <AppText style={styles.emptyResultsDescription}>{tr.map.noResultsDescription}</AppText>
        </View>
      )}
    </View>
  );
}

// The pill on the bottom row that brings back what was put away: the place
// editor, named after what was typed in its draft, or else the place preview.
export function MapReopenPill({
  bottom,
  editor,
  hasMinimizedPlace,
  isSaving,
  onReopenEditor,
  onReopenPlace,
}: {
  bottom: number;
  editor: MinimizedEditorState | null;
  hasMinimizedPlace: boolean;
  isSaving: boolean;
  onReopenEditor: () => void;
  onReopenPlace: () => void;
}) {
  if (!editor && !hasMinimizedPlace) {
    return null;
  }

  const pill = editor
    ? {
        label: tr.map.reopenPanel,
        onPress: onReopenEditor,
        subtitle: isSaving ? tr.placeEditor.saveProgressTitle : tr.map.reopenPanel,
        title:
          editor.draft.name.trim() || editor.panel.name || tr.placeEditor.minimizedNewTitle,
      }
    : {
        label: tr.map.reopenPreview,
        onPress: onReopenPlace,
        subtitle: tr.map.reopenPreview,
        title: tr.map.placeCardLabel,
      };

  return (
    <InstantPressable
      accessibilityLabel={pill.label}
      accessibilityRole="button"
      hitSlop={hitSlopFor(46)}
      style={[styles.reopenEditorButton, { bottom }]}
      onPress={pill.onPress}
    >
      <View style={styles.reopenEditorBody}>
        <AppText numberOfLines={1} style={styles.reopenEditorTitle}>
          {pill.title}
        </AppText>
        <AppText style={styles.reopenEditorSubtitle}>{pill.subtitle}</AppText>
      </View>
      <ChevronUp color={colors.onPrimary} size={iconSize.sm} />
    </InstantPressable>
  );
}
