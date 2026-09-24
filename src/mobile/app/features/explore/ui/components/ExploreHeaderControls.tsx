import React from 'react';
import { Camera, List, MapPin, Search, Users, X, type LucideIcon } from 'lucide-react-native';
import { ScrollView, TextInput, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Chip, chipContentColor } from '@/mobile/app/shared/components/ui/Chip';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, iconSize } from '@/mobile/app/shared/theme/tokens';

import { exploreScreenStyles as styles } from './exploreScreenStyles';
import type { ExploreTabType } from './exploreScreenTypes';

type ExploreHeaderControlsProps = {
  activeTab: ExploreTabType;
  resultCount?: number;
  resultsPending?: boolean;
  // A swipe is between tabs: the count shows the tab being reached, silently.
  resultsPreviewing?: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onTabChange: (tab: ExploreTabType) => void;
};

const MAX_SEARCH_QUERY_LENGTH = 120;

const tabs: Array<{
  key: ExploreTabType;
  label: string;
  Icon: LucideIcon;
}> = [
  {
    key: 'lists',
    label: tr.explore.tabs.lists,
    Icon: List,
  },
  {
    key: 'places',
    label: tr.explore.tabs.places,
    Icon: MapPin,
  },
  {
    key: 'photos',
    label: tr.explore.tabs.photos,
    Icon: Camera,
  },
  {
    key: 'people',
    label: tr.explore.tabs.people,
    Icon: Users,
  },
];

export function ExploreHeaderControls({
  activeTab,
  resultCount,
  resultsPending = false,
  resultsPreviewing = false,
  searchQuery,
  onSearchQueryChange,
  onTabChange,
}: ExploreHeaderControlsProps) {
  const { screenPadding } = useAppLayout();
  const tabScrollRef = React.useRef<ScrollView | null>(null);
  const tabLayoutsRef = React.useRef<Partial<Record<ExploreTabType, { width: number; x: number }>>>({});
  const [tabRailWidth, setTabRailWidth] = React.useState(0);
  const placeholder =
    activeTab === 'lists'
      ? tr.explore.search.list
      : activeTab === 'places'
        ? tr.explore.search.place
        : activeTab === 'photos'
          ? tr.explore.search.photo
          : tr.explore.search.person;
  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label ?? tr.explore.title;
  const searchAccessibilityLabel = `${activeTabLabel}: ${placeholder}`;

  const keepActiveTabVisible = React.useCallback(() => {
    const layout = tabLayoutsRef.current[activeTab];
    if (!layout || tabRailWidth <= 0) {
      return;
    }

    tabScrollRef.current?.scrollTo({
      animated: true,
      x: Math.max(0, layout.x + layout.width / 2 - tabRailWidth / 2),
      y: 0,
    });
  }, [activeTab, tabRailWidth]);

  React.useEffect(() => {
    keepActiveTabVisible();
  }, [keepActiveTabVisible]);

  const handleTabLayout = React.useCallback(
    (tab: ExploreTabType, event: LayoutChangeEvent) => {
      tabLayoutsRef.current[tab] = event.nativeEvent.layout;
      if (tab === activeTab) {
        keepActiveTabVisible();
      }
    },
    [activeTab, keepActiveTabVisible],
  );

  return (
    // Search leads, as on Instagram: the tab bar already names the screen,
    // and a title with a strapline above it took a sixth of the screen.
    <View style={[styles.headerRail, { paddingHorizontal: screenPadding }]}>
      <View style={styles.filtersSection}>
        <View style={styles.searchWrap}>
          <Search color={colors.textMuted} size={iconSize.sm} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            maxLength={MAX_SEARCH_QUERY_LENGTH}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={searchAccessibilityLabel}
            accessibilityState={{ busy: resultsPending || resultsPreviewing }}
            returnKeyType="search"
          />
          {searchQuery ? (
            <InstantPressable
              accessibilityLabel={`${tr.common.clear}: ${activeTabLabel}`}
              accessibilityRole="button"
              hapticFeedback="selection"
              hitSlop={10}
              onPress={() => onSearchQueryChange('')}
              style={styles.searchClearButton}
            >
              <X color={colors.textMuted} size={iconSize.sm} />
            </InstantPressable>
          ) : null}
        </View>

        <View
          style={styles.tabRail}
          onLayout={(event) => setTabRailWidth(Math.round(event.nativeEvent.layout.width))}
        >
          <ScrollView
            ref={tabScrollRef}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {tabs.map(({ Icon, key, label }) => {
              const active = activeTab === key;

              return (
                <Chip
                  key={key}
                  kind="filter"
                  label={label}
                  leading={<Icon color={chipContentColor('filter', active)} size={iconSize.sm} />}
                  onLayout={(event) => handleTabLayout(key, event)}
                  onPress={() => onTabChange(key)}
                  selected={active}
                />
              );
            })}
          </ScrollView>
        </View>

        {typeof resultCount === 'number' ? (
          <AppText
            accessibilityLiveRegion={resultsPreviewing ? 'none' : 'polite'}
            accessibilityState={{ busy: resultsPending }}
            style={styles.resultStatus}
          >
            {resultsPending ? tr.common.loading : tr.map.searchResultCount(resultCount)}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
