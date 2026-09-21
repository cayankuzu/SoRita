import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react-native";

import { AppText } from "@/mobile/app/shared/components/ui/AppText";
import { InstantPressable } from "@/mobile/app/shared/components/ui/InstantPressable";
import { shouldUseCompactProfileTabs } from "@/mobile/app/features/profile/ui/components/profileTabsLayout";
import { tr } from "@/mobile/app/shared/i18n/tr";
import {
  colors,
  fontWeight,
  minTouchSize,
  radius,
  typography,
} from "@/mobile/app/shared/theme/tokens";
import { useAppLayout } from "@/mobile/app/shared/hooks/useAppLayout";

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
  const { fontScale, width } = useAppLayout();
  const compact = shouldUseCompactProfileTabs(width, fontScale);
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
          accessibilityRole="tablist"
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
                accessibilityLabel={
                  typeof tab.count === "number"
                    ? tr.profile.tabAccessibilityLabel(tab.label, tab.count)
                    : tab.label
                }
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={tab.key}
                onPress={() => onChange(tab.key)}
                hapticFeedback="selection"
                style={[styles.button, compact ? styles.buttonCompact : null]}
              >
                {tab.renderIcon(active)}
                <View style={styles.labelWrap}>
                  <AppText
                    numberOfLines={compact ? 2 : 1}
                    style={[styles.text, active ? styles.textActive : null]}
                  >
                    {tab.label}
                  </AppText>
                </View>
                {typeof tab.count === "number" ? (
                  <View
                    style={[
                      styles.countBadge,
                      active ? styles.countBadgeActive : null,
                    ]}
                  >
                    <AppText
                      style={[
                        styles.countText,
                        active ? styles.countTextActive : null,
                      ]}
                    >
                      {tab.count}
                    </AppText>
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
            accessibilityLabel={`${tr.profile.visibilityFilter}: ${activeFilterLabel}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: filterOpen }}
            accessibilityValue={{ text: activeFilterLabel }}
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
            {!compact ? (
              <>
                <AppText
                  style={[
                    styles.filterToggleText,
                    filterOpen ? styles.filterToggleTextActive : null,
                  ]}
                >
                  {activeFilterLabel}
                </AppText>
                {filterOpen ? (
                  <ChevronUp color={colors.primary} size={12} />
                ) : (
                  <ChevronDown color={colors.textMuted} size={12} />
                )}
              </>
            ) : null}
          </InstantPressable>
        ) : null}
      </View>

      {showFilterControls && filterOpen ? (
        <View style={styles.filterWrap}>
          <View accessibilityRole="radiogroup" style={styles.filterRow}>
            {filterOptions?.map((option) => {
              const active = option.key === activeFilter;

              return (
                <InstantPressable
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  key={option.key}
                  onPress={() => onFilterChange?.(option.key)}
                  hapticFeedback="selection"
                  style={[
                    styles.filterChip,
                    active ? styles.filterChipActive : null,
                  ]}
                >
                  <AppText
                    style={[
                      styles.filterChipText,
                      active ? styles.filterChipTextActive : null,
                    ]}
                  >
                    {option.label}
                  </AppText>
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
    minHeight: minTouchSize,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  buttonCompact: {
    flexDirection: "column",
    gap: 2,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  labelWrap: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  text: {
    ...typography.captionText,
    fontWeight: fontWeight.regular,
    flexShrink: 1,
    textAlign: "center",
    color: colors.textMuted,
  },
  textActive: {
    color: colors.primary,
    fontWeight: fontWeight.strong,
  },
  countBadge: {
    minWidth: 18,
    minHeight: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  countBadgeActive: {
    backgroundColor: colors.primaryBg,
  },
  countText: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textSoft,
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
    minWidth: minTouchSize,
    minHeight: minTouchSize,
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
    ...typography.labelText,
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
    minHeight: minTouchSize,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.labelText,
    color: colors.textMuted,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
});
