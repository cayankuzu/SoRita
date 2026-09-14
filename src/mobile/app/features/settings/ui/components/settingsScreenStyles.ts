import { StyleSheet } from 'react-native';

import {
  colors,
  fontWeight,
  radius,
  typography,
} from '@/mobile/app/shared/theme/tokens';

export const settingsScreenStyles = StyleSheet.create({
  sectionStack: {
    gap: 18,
  },
  form: {
    gap: 12,
  },
  sectionTitle: {
    marginTop: 10,
    ...typography.labelText,
    color: colors.textSoft,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepCounter: {
    ...typography.metadataText,
    fontWeight: fontWeight.strong,
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
    ...typography.bodyText,
    color: colors.textMuted,
  },
  helperCard: {
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
  },
  helperCardTitle: {
    ...typography.labelText,
    color: colors.text,
  },
  helperCardText: {
    ...typography.captionText,
    color: colors.textMuted,
  },
  selectionMeta: {
    ...typography.metadataText,
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
    ...typography.labelText,
    color: colors.text,
  },
  loadingCardText: {
    ...typography.captionText,
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
  passwordInput: {
    paddingRight: 56,
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
    ...typography.labelText,
    color: colors.textSoft,
  },
  emailInfoValue: {
    ...typography.bodyText,
    fontWeight: fontWeight.strong,
    color: colors.text,
  },
  emailInfoText: {
    ...typography.captionText,
    color: colors.textMuted,
  },
  successCard: {
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.successBg,
    padding: 10,
  },
  successTitle: {
    ...typography.labelText,
    color: colors.secondary,
  },
  successText: {
    ...typography.captionText,
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
    ...typography.labelText,
    color: colors.text,
  },
  blockedUserUsername: {
    marginTop: 2,
    ...typography.metadataText,
    fontWeight: fontWeight.regular,
    color: colors.textSoft,
  },
  blockedUserBio: {
    marginTop: 4,
    ...typography.captionText,
    color: colors.textMuted,
  },
  blockedUserAction: {
    ...typography.labelText,
    color: colors.primary,
  },
  savingStatus: {
    ...typography.captionText,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
