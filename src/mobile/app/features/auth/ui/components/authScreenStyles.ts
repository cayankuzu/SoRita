import { StyleSheet } from 'react-native';

import {
  colors,
  fontWeight,
  radius,
  spacing,
  tabularNumbers,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';

export const authScreenStyles = StyleSheet.create({
  landingScreen: {
    flex: 1,
  },
  landingScreenRegular: {
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  landingScreenCompact: {
    justifyContent: 'flex-start',
    paddingTop: spacing.sm,
  },
  landingContent: {
    width: '100%',
    gap: spacing.md,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  landingSubtitle: {
    ...typography.bodyText,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  authScreen: {
    flexGrow: 1,
    paddingTop: spacing.sm,
  },
  authBrandRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  authBrandRowCompact: {
    marginBottom: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  headerBlockCompact: {
    marginTop: 0,
    marginBottom: spacing.md,
  },
  previewBackRow: {
    marginBottom: spacing.sm,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepProgress: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepCounter: textStyle('labelText', colors.textMuted),
  stepCopy: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  stepTitle: textStyle('title', colors.text),
  stepDescription: textStyle('bodyText', colors.textMuted),
  screenTitle: textStyle('headlineText', colors.text),
  screenSubtitle: {
    marginTop: spacing.xxs,
    ...typography.bodyText,
    color: colors.textMuted,
  },
  formBlock: {
    gap: spacing.md,
  },
  confirmationCard: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryBg,
    padding: spacing.card,
  },
  confirmationTitle: textStyle('bodyText', colors.primaryDark, fontWeight.strong),
  confirmationText: textStyle('bodyText', colors.textMuted),
  footerText: {
    ...typography.bodyText,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerRow: {
    minHeight: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
  },
  footerLinkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  footerLink: textStyle('bodyText', colors.primary, fontWeight.strong),
  registerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  spacer: {
    width: 44,
  },
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
    marginBottom: spacing.md,
  },
  atIcon: textStyle('bodyText', colors.textMuted, fontWeight.medium),
  photoSection: {
    alignItems: 'center',
    width: '100%',
  },
  helperCard: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.card,
  },
  helperCardTitle: textStyle('bodyText', colors.text, fontWeight.strong),
  helperCardText: textStyle('captionText', colors.textMuted, fontWeight.regular),
  selectionMeta: textStyle('captionText', colors.textMuted, fontWeight.medium),
  formError: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    ...typography.captionText,
    fontWeight: fontWeight.medium,
    padding: spacing.md,
  },
  counterText: {
    marginTop: -6,
    textAlign: 'right',
    ...typography.metadataText,
    ...tabularNumbers,
    color: colors.textMuted,
  },
  bottomActions: {
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  bottomActionsCompact: {
    marginTop: spacing.md,
  },
  stepActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  stepButton: {
    flex: 1,
    minWidth: 120,
  },
});
