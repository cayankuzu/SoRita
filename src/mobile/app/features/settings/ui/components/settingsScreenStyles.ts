import { StyleSheet } from 'react-native';

import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

export const settingsScreenStyles = StyleSheet.create({
  sectionStack: {
    gap: 18,
  },
  form: {
    gap: 12,
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
    color: colors.textSoft,
  },
  stepCopy: {
    marginBottom: 14,
    gap: 4,
  },
  stepTitle: {
    ...typography.title,
    color: colors.text,
  },
  stepDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
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
    color: colors.textSoft,
  },
  photoSection: {
    alignItems: 'center',
    width: '100%',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
  },
  loadingCardBody: {
    flex: 1,
    gap: 2,
  },
  loadingCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  loadingCardText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  stepActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  stepButton: {
    flex: 1,
  },
  counterText: {
    marginTop: -6,
    textAlign: 'right',
    ...typography.metadataText,
    color: colors.textSoft,
  },
  passwordField: {
    position: 'relative',
  },
  emailInfoCard: {
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: 10,
  },
  emailInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  emailInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  emailInfoText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  successCard: {
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.successBg,
    padding: 10,
  },
  successTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  successText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.secondary,
  },
  blockedList: {
    paddingBottom: 16,
  },
  blockedListEmpty: {
    flexGrow: 1,
  },
  blockedSeparator: {
    height: 10,
  },
  blockedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
  },
  blockedUserBody: {
    flex: 1,
  },
  blockedUserName: {
    fontSize: 12,
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
