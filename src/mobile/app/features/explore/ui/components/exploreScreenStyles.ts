import { StyleSheet } from 'react-native';

import { colors, fontWeight, radius, spacing, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

export const exploreScreenStyles = StyleSheet.create({
  headerRail: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  header: {
    paddingBottom: 10,
    gap: 4,
  },
  title: textStyle('title', colors.text),
  subtitle: textStyle('bodyText', colors.textMuted),
  filtersSection: {
    gap: 8,
  },
  searchWrap: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    ...typography.bodyText,
    paddingVertical: 8,
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
    paddingVertical: 2,
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: 44,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 10,
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
    paddingVertical: 10,
    gap: 12,
  },
  feedList: {
    flex: 1,
  },
});
