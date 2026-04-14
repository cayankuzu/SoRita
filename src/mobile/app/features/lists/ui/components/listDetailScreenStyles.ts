import { StyleSheet } from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export const listDetailScreenStyles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  header: {
    gap: 8,
    paddingBottom: 4,
  },
  backLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  headerBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerAside: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  likesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coverThumbButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceMuted,
  },
  coverThumbImage: {
    width: '100%',
    height: '100%',
  },
  coverThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  coverThumbEmoji: {
    fontSize: 26,
  },
  headerReportButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  mapSection: {
    gap: 6,
  },
  mapHelper: {
    fontSize: 10,
    color: colors.textSoft,
    textAlign: 'center',
  },
  description: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  feed: {
    gap: 16,
    marginTop: 14,
    marginHorizontal: -16,
  },
  highlightedCard: {
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
