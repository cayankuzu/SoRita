import { StyleSheet } from 'react-native';

import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

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
    fontSize: 12,
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
  stepCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepCopy: {
    marginBottom: 14,
    gap: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  stepDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  screenSubtitle: {
    marginTop: 2,
    fontSize: 12,
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
  confirmationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  confirmationText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
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
  footerLink: {
    color: colors.primary,
    fontWeight: '700',
    lineHeight: 18,
  },
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
  atIcon: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  passwordMeter: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -4,
  },
  passwordMeterItem: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
  },
  passwordMeterWarm: {
    backgroundColor: colors.warning,
  },
  passwordMeterStrong: {
    backgroundColor: colors.secondary,
  },
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
  helperCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  helperCardText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  selectionMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  selectionMetaError: {
    color: colors.danger,
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
