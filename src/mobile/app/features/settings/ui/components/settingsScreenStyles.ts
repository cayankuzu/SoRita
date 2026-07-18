import { StyleSheet } from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export const settingsScreenStyles = StyleSheet.create({
  sectionStack: {
    gap: 24,
  },
  form: {
    gap: 16,
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
    color: colors.textSoft,
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
    color: colors.textSoft,
  },
  photoSection: {
    alignItems: 'center',
    width: '100%',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
  },
  loadingCardBody: {
    flex: 1,
    gap: 2,
  },
  loadingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  loadingCardText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  stepActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  stepButton: {
    flex: 1,
  },
  counterText: {
    marginTop: -8,
    textAlign: 'right',
    fontSize: 11,
    color: colors.textSoft,
  },
  passwordField: {
    position: 'relative',
  },
  emailInfoCard: {
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 14,
  },
  emailInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emailInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  emailInfoValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  emailInfoText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  successCard: {
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.successBg,
    padding: 14,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
  },
  successText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.secondary,
  },
  blockedList: {
    paddingBottom: 20,
  },
  blockedListEmpty: {
    flexGrow: 1,
  },
  blockedSeparator: {
    height: 12,
  },
  blockedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
  },
  blockedUserBody: {
    flex: 1,
  },
  blockedUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  blockedUserUsername: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSoft,
  },
  blockedUserBio: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
  },
  blockedUserAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
