import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react-native";

import { AppText } from "@/mobile/app/shared/components/ui/AppText";
import { Chip } from "@/mobile/app/shared/components/ui/Chip";
import { InstantPressable } from "@/mobile/app/shared/components/ui/InstantPressable";
import { shouldUseCompactProfileTabs } from "@/mobile/app/features/profile/ui/components/profileTabsLayout";
import { tr } from "@/mobile/app/shared/i18n/tr";
import {
  colors,
  fontWeight,
  iconSize,
  minTouchSize,
  radius,
  spacing,
  tabularNumbers,
  textStyle,
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
              size={iconSize.xs}
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
                  <ChevronUp color={colors.primary} size={iconSize.xs} />
                ) : (
                  <ChevronDown color={colors.textMuted} size={iconSize.xs} />
                )}
              </>
            ) : null}
          </InstantPressable>
        ) : null}
      </View>

      {showFilterControls && filterOpen ? (
        <View style={styles.filterWrap}>
          <View accessibilityRole="radiogroup" style={styles.filterRow}>
            {filterOptions?.map((option) => (
              <Chip
                accessibilityRole="radio"
                key={option.key}
                kind="filter"
                label={option.label}
                onPress={() => onFilterChange?.(option.key)}
                selected={option.key === activeFilter}
              />
            ))}
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
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  buttonCompact: {
    flexDirection: "column",
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  labelWrap: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  countBadgeActive: {
    backgroundColor: colors.primaryBg,
  },
  countText: { ...textStyle('metadataText', colors.textSoft, fontWeight.strong), ...tabularNumbers },
  countTextActive: {
    color: colors.primary,
  },
  filterWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
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
    gap: spacing.xs,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
  },
  activeIndicatorSlot: {
    position: "absolute",
    left: 0,
    bottom: -1,
    height: 2,
    paddingHorizontal: spacing.sm,
  },
  activeIndicator: {
    flex: 1,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  filterToggleActive: {
    backgroundColor: colors.primaryBg,
  },
  filterToggleText: textStyle('labelText', colors.textMuted),
  filterToggleTextActive: {
    color: colors.primary,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
});
