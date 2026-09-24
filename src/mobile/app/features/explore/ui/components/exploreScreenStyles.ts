import { StyleSheet } from 'react-native';

import { colors, fontWeight, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

export const exploreScreenStyles = StyleSheet.create({
  headerRail: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  filtersSection: {
    gap: spacing.sm,
  },
  searchWrap: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.bodyText,
    paddingVertical: spacing.sm,
  },
  searchClearButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  tabRail: {
    minHeight: 44,
  },
  // A horizontal scroll view clips hit slop at its edges, so the row carries
  // the room a 36dp chip needs to reach 48dp.
  tabRow: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  resultStatus: textStyle('metadataText', colors.textSoft, fontWeight.strong),
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
});
