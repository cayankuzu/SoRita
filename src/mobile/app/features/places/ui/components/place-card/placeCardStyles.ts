import { StyleSheet } from 'react-native';

import { colors, layout, radius } from '@/mobile/app/shared/theme/tokens';

export const placeCardStyles = StyleSheet.create({
  compactCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  compactImageWrap: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
  },
  compactBody: {
    padding: 10,
    gap: 4,
  },
  compactTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  compactTitleContent: {
    flex: 1,
    minWidth: 0,
  },
  compactTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  compactDescription: {
    fontSize: 10,
    color: colors.textMuted,
  },
  compactTimestampBlock: {
    gap: 2,
  },
  compactTimestampText: {
    fontSize: 9,
    color: colors.textSoft,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 10,
    color: colors.warningText,
    fontWeight: '600',
  },
  feedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  userBody: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  userUsername: {
    fontSize: 11,
    color: colors.textSoft,
  },
  iconButton: {
    padding: 6,
  },
  linkBar: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkBarCover: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  linkBarCoverFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  linkBarBody: {
    flex: 1,
    minWidth: 0,
  },
  linkBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkBarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  linkBarMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  linkBarMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSoft,
  },
  linkBarMetaTextPrivate: {
    color: colors.danger,
  },
  mapWrap: {
    paddingHorizontal: 14,
  },
  thumbRow: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  thumb: {
    width: layout.thumbnailSize,
    height: layout.thumbnailSize,
    borderRadius: 14,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 4,
  },
  contentTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  contentTitleContent: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  timestampBlock: {
    gap: 2,
    paddingTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: colors.textSoft,
  },
  tagSection: {
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  badgeRow: {
    gap: 8,
    alignItems: 'center',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningBg,
  },
  ratingBadgeText: {
    color: colors.warningText,
  },
  studentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryBg,
  },
  studentBadgeText: {
    color: colors.primary,
  },
  purpleBadge: {
    backgroundColor: colors.purpleBg,
  },
  purpleBadgeText: {
    color: colors.purple,
  },
  greenBadge: {
    backgroundColor: colors.successBg,
  },
  greenBadgeText: {
    color: colors.secondary,
  },
  inlineIcon: {
    justifyContent: 'center',
  },
  focusActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  focusActionButtonActive: {
    backgroundColor: colors.primaryBg,
  },
});
