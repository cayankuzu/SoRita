import React from 'react';
import { Camera, List, MapPin, Search, Users, X } from 'lucide-react-native';
import { ScrollView, Text, TextInput, View } from 'react-native';

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
  const placeholder =
    activeTab === 'lists'
      ? tr.explore.search.list
      : activeTab === 'places'
        ? tr.explore.search.place
        : activeTab === 'photos'
          ? tr.explore.search.photo
          : tr.explore.search.person;

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
              onPress={() => onSearchQueryChange('')}
              style={styles.searchClearButton}
            >
              <X color={colors.textMuted} size={14} />
            </InstantPressable>
          ) : null}
        </View>

        <View style={styles.tabRail}>
          <ScrollView
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
