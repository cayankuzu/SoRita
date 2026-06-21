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
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 2,
  },
  userBody: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  userUsername: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSoft,
  },
  iconButton: {
    padding: 6,
  },
  sourceBar: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceAvatarWrap: {
    position: 'relative',
  },
  sourceBarIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryBg,
  },
  sourceBarBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sourceBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  sourceBarTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  sourceBarUsername: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSoft,
    flexShrink: 1,
  },
  sourceBarMeta: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  linkBar: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    paddingHorizontal: 16,
  },
  thumbRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  thumb: {
    width: layout.thumbnailSize,
    height: layout.thumbnailSize,
    borderRadius: 14,
  },
  content: {
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
