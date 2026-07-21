import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react-native";

import { InstantPressable } from "@/mobile/app/shared/components/ui/InstantPressable";
import { tr } from "@/mobile/app/shared/i18n/tr";
import { colors, typography } from "@/mobile/app/shared/theme/tokens";

export type ProfileTabOption = {
  key: string;
  label: string;
  count?: number;
  renderIcon: (active: boolean) => React.ReactNode;
};

export type ProfileVisibilityFilter = "all" | "public" | "private";

type ProfileTabsProps = {
  activeTab: string;
  activeFilter?: ProfileVisibilityFilter;
  filterOpen?: boolean;
  filterOptions?: Array<{ key: ProfileVisibilityFilter; label: string }>;
  progressIndex?: Animated.Value;
  onChange: (key: string) => void;
  onFilterChange?: (filter: ProfileVisibilityFilter) => void;
  onFilterToggle?: () => void;
  tabs: ProfileTabOption[];
};

export function ProfileTabs({
  activeTab,
  activeFilter = "all",
  filterOpen = false,
  filterOptions,
  progressIndex,
  onChange,
  onFilterChange,
  onFilterToggle,
  tabs,
}: ProfileTabsProps) {
  const [tabsWidth, setTabsWidth] = React.useState(0);
  const showFilterControls = Boolean(
    filterOptions?.length && onFilterChange && onFilterToggle,
  );
  const activeFilterLabel =
    filterOptions?.find((option) => option.key === activeFilter)?.label ||
    activeFilter;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeTab),
  );
  const tabWidth = tabs.length > 0 ? tabsWidth / tabs.length : 0;
  const indicatorTranslateX =
    progressIndex && tabs.length > 1
      ? progressIndex.interpolate({
          inputRange: [0, tabs.length - 1],
          outputRange: [0, tabWidth * (tabs.length - 1)],
          extrapolate: "clamp",
        })
      : activeIndex * tabWidth;

  return (
    <View>
      <View style={styles.tabsShell}>
        <View
          style={styles.wrap}
          onLayout={(event) => {
            const nextWidth = Math.round(event.nativeEvent.layout.width);
            setTabsWidth((currentWidth) =>
              currentWidth === nextWidth ? currentWidth : nextWidth,
            );
          }}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key;

            return (
              <InstantPressable
                accessibilityLabel={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={tab.key}
                onPress={() => onChange(tab.key)}
                hapticFeedback="selection"
                style={styles.button}
              >
                {tab.renderIcon(active)}
                <View style={styles.labelWrap}>
                  <Text
                    style={[styles.text, active ? styles.textActive : null]}
                  >
                    {tab.label}
                  </Text>
                </View>
                {typeof tab.count === "number" ? (
                  <View
                    style={[
                      styles.countBadge,
                      active ? styles.countBadgeActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        active ? styles.countTextActive : null,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                ) : null}
              </InstantPressable>
            );
          })}
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeIndicatorSlot,
                {
                  width: tabWidth,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            >
              <View style={styles.activeIndicator} />
            </Animated.View>
          ) : null}
        </View>
        {showFilterControls ? (
          <InstantPressable
        accessibilityLabel={tr.profile.visibilityFilter}
            accessibilityRole="button"
            accessibilityState={{ expanded: filterOpen }}
            onPress={onFilterToggle}
            style={[
              styles.filterToggle,
              filterOpen ? styles.filterToggleActive : null,
            ]}
          >
            <SlidersHorizontal
              color={filterOpen ? colors.primary : colors.textMuted}
              size={13}
            />
            <Text
              style={[
                styles.filterToggleText,
                filterOpen ? styles.filterToggleTextActive : null,
              ]}
            >
              {activeFilterLabel}
            </Text>
            {filterOpen ? (
              <ChevronUp color={colors.primary} size={12} />
            ) : (
              <ChevronDown color={colors.textMuted} size={12} />
            )}
          </InstantPressable>
        ) : null}
      </View>

      {showFilterControls && filterOpen ? (
        <View style={styles.filterWrap}>
          <View style={styles.filterRow}>
            {filterOptions?.map((option) => {
              const active = option.key === activeFilter;

              return (
                <InstantPressable
                  accessibilityLabel={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={option.key}
                  onPress={() => onFilterChange?.(option.key)}
                  hapticFeedback="selection"
                  style={[
                    styles.filterChip,
                    active ? styles.filterChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active ? styles.filterChipTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </InstantPressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabsShell: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  wrap: {
    flex: 1,
    flexDirection: "row",
    position: "relative",
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  text: {
    fontSize: 12,
    color: colors.textMuted,
  },
  textActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
  countBadgeActive: {
    backgroundColor: colors.primaryBg,
  },
  countText: {
    ...typography.metadataText,
    fontWeight: "700",
    color: colors.textDisabled,
  },
  countTextActive: {
    color: colors.primary,
  },
  filterWrap: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  filterToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.cardBorder,
    paddingHorizontal: 8,
  },
  activeIndicatorSlot: {
    position: "absolute",
    left: 0,
    bottom: -1,
    height: 2,
    paddingHorizontal: 6,
  },
  activeIndicator: {
    flex: 1,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  filterToggleActive: {
    backgroundColor: colors.primaryBg,
  },
  filterToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  filterToggleTextActive: {
    color: colors.primary,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterChip: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primaryBg,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
});
