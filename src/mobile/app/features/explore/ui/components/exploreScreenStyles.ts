import { StyleSheet } from 'react-native';

import { colors, fontWeight, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

export const exploreScreenStyles = StyleSheet.create({
  headerRail: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  header: {
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: textStyle('title', colors.text),
  subtitle: textStyle('bodyText', colors.textMuted),
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
  tabRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: 44,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tabText: textStyle('metadataText', colors.textMuted, fontWeight.strong),
  tabTextActive: {
    color: colors.onPrimary,
  },
  resultStatus: textStyle('metadataText', colors.textSoft, fontWeight.strong),
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  feedTitle: textStyle('bodyText', colors.text, fontWeight.strong),
  feedContent: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  feedList: {
    flex: 1,
  },
});
