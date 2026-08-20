import React from 'react';
import { Camera, List, MapPin, Search, Users, X } from 'lucide-react-native';
import { ScrollView, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';

import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors } from '@/mobile/app/shared/theme/tokens';

import { exploreScreenStyles as styles } from './exploreScreenStyles';
import type { ExploreTabType } from './exploreScreenTypes';

type ExploreHeaderControlsProps = {
  activeTab: ExploreTabType;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onTabChange: (tab: ExploreTabType) => void;
};

const tabs: Array<{
  key: ExploreTabType;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
}> = [
  {
    key: 'lists',
    label: tr.explore.tabs.lists,
    renderIcon: (active) => <List color={active ? colors.onPrimary : colors.textMuted} size={13} />,
  },
  {
    key: 'places',
    label: tr.explore.tabs.places,
    renderIcon: (active) => <MapPin color={active ? colors.onPrimary : colors.textMuted} size={13} />,
  },
  {
    key: 'photos',
    label: tr.explore.tabs.photos,
    renderIcon: (active) => <Camera color={active ? colors.onPrimary : colors.textMuted} size={13} />,
  },
  {
    key: 'people',
    label: tr.explore.tabs.people,
    renderIcon: (active) => <Users color={active ? colors.onPrimary : colors.textMuted} size={13} />,
  },
];

export function ExploreHeaderControls({
  activeTab,
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
    <View style={[styles.headerRail, { paddingHorizontal: screenPadding }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{tr.explore.title}</Text>
        <Text style={styles.subtitle}>{tr.explore.subtitle}</Text>
      </View>

      <View style={styles.filtersSection}>
        <View style={styles.searchWrap}>
          <Search color={colors.textMuted} size={14} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={placeholder}
            returnKeyType="search"
          />
          {searchQuery ? (
            <InstantPressable
              accessibilityLabel={tr.common.clear}
              accessibilityRole="button"
              hapticFeedback="selection"
              hitSlop={10}
              onPress={() => onSearchQueryChange('')}
              style={styles.searchClearButton}
            >
              <X color={colors.textMuted} size={14} />
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
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.key;

              return (
                <InstantPressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={tab.key}
                  onLayout={(event) => handleTabLayout(tab.key, event)}
                  onPress={() => onTabChange(tab.key)}
                  hapticFeedback="selection"
                  style={[styles.tabButton, active ? styles.tabButtonActive : null]}
                >
                  {tab.renderIcon(active)}
                  <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                    {tab.label}
                  </Text>
                </InstantPressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
