import { StyleSheet } from 'react-native';

import {
  colors,
  elevation,
  fontWeight,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
  zIndex,
} from '@/mobile/app/shared/theme/tokens';

export const listDetailScreenStyles = StyleSheet.create({
  screenLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenShell: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  scrollTopButton: {
    position: 'absolute',
    right: spacing.md,
    width: minTouchSize,
    height: minTouchSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    ...elevation.floating,
  },
  header: {
    paddingHorizontal: spacing.md,
  },
  heroCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...elevation.card,
  },
  heroMediaWrap: {
    position: 'relative',
    minHeight: 144,
    backgroundColor: colors.primaryBg,
  },
  heroMediaButton: {
    minHeight: 144,
  },
  heroMedia: {
    width: '100%',
    height: 144,
  },
  heroMediaScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.imageScrim,
  },
  coverHint: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  heroBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  title: textStyle('title', colors.text),
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroTimestamp: {
    ...typography.captionText,
    lineHeight: typography.compactTitleText.fontSize,
    fontWeight: fontWeight.regular,
    color: colors.textSoft,
  },
  sectionStack: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  ownerAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  ownerBody: {
    flex: 1,
    minWidth: 0,
  },
  ownerEyebrow: textStyle('labelText', colors.textSoft),
  ownerName: {
    marginTop: spacing.xxs,
    ...typography.labelText,
    color: colors.text,
  },
  ownerUsername: {
    marginTop: spacing.xxs,
    ...typography.metadataText,
    color: colors.textMuted,
  },
  descriptionCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  descriptionCardLabel: textStyle('labelText', colors.textSoft),
  description: textStyle('bodyText', colors.textMuted),
  mapSection: {
    gap: spacing.sm,
  },
  mapCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mapCardEyebrow: textStyle('labelText', colors.textSoft),
  mapCardTitle: {
    marginTop: spacing.xxs,
    ...typography.bodyText,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  mapFrame: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  mapHelper: {
    ...typography.metadataText,
    lineHeight: typography.compactTitleText.fontSize,
    color: colors.textSoft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xxs,
  },
  sectionHeaderCopy: {
    flex: 1,
  },
  sectionEyebrow: textStyle('labelText', colors.textSoft),
  sectionTitle: {
    marginTop: spacing.xxs,
    ...typography.section,
    color: colors.text,
  },
  sectionSubtitle: {
    marginTop: spacing.xs,
    ...typography.captionText,
    color: colors.textMuted,
  },
  feed: {
    gap: spacing.md,
  },
  feedLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  // Same inset as the list header above it; without it the cards ran to the
  // screen edge and clipped their own rounded corners there.
  placeCardShell: {
    marginHorizontal: spacing.screen,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  placeCardShellHighlighted: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  // Drawn over the card's corner so selecting a place never shifts the card.
  highlightBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: zIndex.overlay,
  },
  emptyWrap: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
});
