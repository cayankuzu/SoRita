import { StyleSheet } from 'react-native';

import {
  colors,
  minTouchSize,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';

export const discoveryTileStyles = StyleSheet.create({
  tile: {
    minHeight: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tileFullWidth: {
    width: '100%',
  },
  tileCompact: {
    minHeight: 0,
  },
  userTile: {
    minHeight: 0,
  },
  userTileMainAction: {
    width: '100%',
  },
  ownerUsername: {
    fontSize: typography.metadataText.fontSize,
    lineHeight: typography.metadataText.lineHeight,
    color: colors.textSoft,
  },
  tileTitle: textStyle('labelText', colors.text),
  tileDescription: {
    marginTop: spacing.xs,
    ...typography.metadataText,
    color: colors.textMuted,
  },
  userCover: {
    height: 50,
    backgroundColor: colors.coverFallback,
  },
  userAvatarWrap: {
    marginTop: -18,
    paddingHorizontal: spacing.sm,
  },
  userAvatarFrame: {
    width: 44,
    height: 44,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
  },
  userTileBody: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  userTileBodyMain: {
    paddingBottom: 0,
  },
  followButton: {
    minHeight: minTouchSize,
    marginHorizontal: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  followButtonPassive: {
    backgroundColor: colors.surfaceMuted,
  },
  followButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  followButtonText: textStyle('labelText', colors.onPrimary),
  followButtonTextPassive: {
    color: colors.textMuted,
  },
});
