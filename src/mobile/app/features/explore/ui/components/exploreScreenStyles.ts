import { StyleSheet } from 'react-native';

import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

export const exploreScreenStyles = StyleSheet.create({
  headerRail: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  header: {
    paddingBottom: 14,
    gap: 4,
  },
  title: {
    fontSize: typography.screenTitle,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  filtersSection: {
    gap: 10,
  },
  searchWrap: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  tabRail: {
    minHeight: 48,
  },
  tabRow: {
    gap: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: 44,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabButtonActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.onPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  feedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  feedContent: {
    paddingVertical: 12,
    gap: 16,
  },
});
