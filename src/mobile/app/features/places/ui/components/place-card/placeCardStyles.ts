import { StyleSheet } from 'react-native';

import {
  colors,
  fontWeight,
  minTouchSize,
  opacity,
  radius,
  spacing,
  tabularNumbers,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';

// Painted height of a tag chip: one metadata line plus 4dp above and below.
// The expand toggle sits among the chips, so it is painted at the same height
// and takes the rest of its touch target from hitSlop.
export const TAG_CHIP_HEIGHT = 24;

export const placeCardStyles = StyleSheet.create({
  feedCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
  },
  userHeader: {
    minHeight: minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxs,
  },
  userBody: {
    flex: 1,
  },
  userName: textStyle('labelText', colors.text),
  userUsername: {
    marginTop: spacing.xxs,
    ...typography.metadataText,
    fontWeight: fontWeight.regular,
    color: colors.textSoft,
  },
  sourceBar: {
    minHeight: minTouchSize,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.purpleBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceAvatarWrap: {
    position: 'relative',
  },
  sourceBarIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.quote,
    borderWidth: 2,
    borderColor: colors.purpleBg,
  },
  sourceBarBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sourceBarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  sourceBarTitle: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.text,
    flexShrink: 1,
  },
  sourceBarUsername: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
    color: colors.textSoft,
    flexShrink: 1,
  },
  sourceBarMeta: textStyle('metadataText', colors.quote),
  // The list is the post's context line, not a card inside the card: no fill,
  // no border, aligned to the content edge.
  linkBar: {
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkBarCover: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  linkBarCoverFallback: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
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
    gap: spacing.xs,
  },
  linkBarTitle: textStyle('supportingLabelText', colors.text),
  linkBarMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  linkBarMetaText: textStyle('metadataText', colors.textSoft),
  linkBarMetaTextPrivate: {
    color: colors.visibilityPrivate,
  },
  mapWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  // The inset lives on a wrapper, as in mapWrap: Yoga subtracts a horizontal
  // margin twice from a stretched child that also has an aspectRatio, which
  // left every photo 12dp short on its right edge.
  mediaCarouselWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  mediaCarouselFrame: {
    aspectRatio: 1.28,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.deepBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  mediaCarousel: {
    flex: 1,
  },
  mediaCarouselPage: {
    height: '100%',
  },
  mediaCarouselMedia: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.deepBackground,
  },
  mediaCarouselCounter: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.darkOverlay,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mediaCarouselCounterText: {
    ...textStyle('metadataText', colors.onPrimary, fontWeight.strong),
    ...tabularNumbers,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationText: {
    ...typography.metadataText,
    flex: 1,
    color: colors.textMuted,
    fontWeight: fontWeight.regular,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  contentTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  contentTitleButton: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minWidth: 0,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  contentTitleButtonInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentTitleButtonPressed: {
    backgroundColor: colors.primaryBg,
  },
  contentTitleInline: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minWidth: 0,
    gap: spacing.xs,
  },
  contentTitleStack: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minWidth: 0,
    gap: spacing.xxs,
  },
  contentTitleContent: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: textStyle('metadataText', colors.secondary, fontWeight.strong),
  title: {
    ...typography.compactTitleText,
    color: colors.text,
    flexShrink: 1,
  },
  titleLink: {
    color: colors.text,
  },
  titleMeta: textStyle('metadataText', colors.textSoft),
  contentTitleChevron: {
    flexShrink: 0,
  },
  // The note is the author's own words and the reason the card exists: full
  // contrast at reading size, not helper grey.
  description: textStyle('readingBodyText', colors.text),
  menuAction: {
    alignSelf: 'flex-start',
    minHeight: 40,
    maxWidth: '100%',
    marginTop: spacing.xxs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  menuActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuActionPressed: {
    opacity: opacity.pressed,
    transform: [{ scale: 0.98 }],
  },
  menuActionIcon: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  menuActionLabel: textStyle('metadataText', colors.primary, fontWeight.strong),
  menuUrlPreview: {
    maxWidth: 270,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    gap: spacing.xs,
  },
  menuUrlText: textStyle('metadataText', colors.textMuted),
  menuHoldHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  menuHoldHintText: textStyle('metadataText', colors.textSoft),
  timestampBlock: {
    paddingTop: 1,
  },
  timestampText: textStyle('metadataText', colors.textSoft),
  tagSection: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  moreFeaturesButton: {
    minHeight: TAG_CHIP_HEIGHT,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primaryBg,
  },
  moreFeaturesText: textStyle('metadataText', colors.primary, fontWeight.strong),
  badgeRow: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: textStyle('metadataText', colors.textMuted),
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningBg,
  },
  ratingBadgeText: {
    color: colors.warning,
  },
  studentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
});
