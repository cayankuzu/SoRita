import { StyleSheet } from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export const authScreenStyles = StyleSheet.create({
  landingScreen: {
    flex: 1,
    justifyContent: 'center',
  },
  landingContent: {
    width: '100%',
    gap: 14,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  landingSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 22,
  },
  authScreen: {
    flexGrow: 1,
    paddingTop: 8,
  },
  authBrandRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    marginTop: 6,
    marginBottom: 18,
  },
  previewBackRow: {
    marginBottom: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepCopy: {
    marginBottom: 18,
    gap: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  screenSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textMuted,
  },
  formBlock: {
    gap: 16,
  },
  confirmationCard: {
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryBg,
    padding: 14,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  confirmationText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
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
    lineHeight: 20,
  },
  registerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  spacer: {
    width: 44,
  },
  stepIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
    marginBottom: 12,
  },
  atIcon: {
    fontSize: 16,
    color: colors.textMuted,
    fontWeight: '600',
  },
  passwordMeter: {
    flexDirection: 'row',
    gap: 6,
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
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
  },
  helperCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  helperCardText: {
    fontSize: 13,
    lineHeight: 19,
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
    marginTop: -8,
    textAlign: 'right',
    fontSize: 11,
    color: colors.textMuted,
  },
  bottomActions: {
    gap: 12,
    marginTop: 24,
    paddingBottom: 12,
  },
  stepActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
    paddingBottom: 12,
  },
  stepButton: {
    flex: 1,
    minWidth: 140,
  },
});
