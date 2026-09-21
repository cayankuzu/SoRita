import { StyleSheet } from 'react-native';

import { colors, fontWeight, radius, textStyle, typography } from '@/mobile/app/shared/theme/tokens';

export const authScreenStyles = StyleSheet.create({
  landingScreen: {
    flex: 1,
  },
  landingScreenRegular: {
    justifyContent: 'center',
    paddingVertical: 20,
  },
  landingScreenCompact: {
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  landingContent: {
    width: '100%',
    gap: 10,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  landingSubtitle: {
    ...typography.bodyText,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 18,
  },
  authScreen: {
    flexGrow: 1,
    paddingTop: 6,
  },
  authBrandRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  authBrandRowCompact: {
    marginBottom: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    marginTop: 4,
    marginBottom: 14,
  },
  headerBlockCompact: {
    marginTop: 0,
    marginBottom: 10,
  },
  previewBackRow: {
    marginBottom: 6,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepProgress: {
    alignItems: 'center',
    gap: 4,
  },
  stepCounter: textStyle('labelText', colors.textMuted),
  stepCopy: {
    marginBottom: 14,
    gap: 4,
  },
  stepTitle: textStyle('title', colors.text),
  stepDescription: textStyle('bodyText', colors.textMuted),
  screenTitle: textStyle('headlineText', colors.text),
  screenSubtitle: {
    marginTop: 2,
    ...typography.bodyText,
    color: colors.textMuted,
  },
  formBlock: {
    gap: 12,
  },
  confirmationCard: {
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryBg,
    padding: 10,
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
    gap: 4,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
  },
  footerLinkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  footerLink: textStyle('bodyText', colors.primary, fontWeight.strong),
  registerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    marginBottom: 10,
  },
  atIcon: textStyle('bodyText', colors.textMuted, fontWeight.medium),
  photoSection: {
    alignItems: 'center',
    width: '100%',
  },
  helperCard: {
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
  },
  helperCardTitle: textStyle('bodyText', colors.text, fontWeight.strong),
  helperCardText: textStyle('captionText', colors.textMuted, fontWeight.regular),
  selectionMeta: textStyle('captionText', colors.textMuted, fontWeight.medium),
  formError: {
    marginTop: 12,
    borderRadius: radius.md,
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    ...typography.captionText,
    fontWeight: fontWeight.medium,
    padding: 10,
  },
  counterText: {
    marginTop: -6,
    textAlign: 'right',
    ...typography.metadataText,
    color: colors.textMuted,
  },
  bottomActions: {
    gap: 10,
    marginTop: 18,
    paddingBottom: 10,
  },
  bottomActionsCompact: {
    marginTop: 12,
  },
  stepActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
    paddingBottom: 10,
  },
  stepButton: {
    flex: 1,
    minWidth: 120,
  },
});
