import { StyleSheet } from 'react-native';

import {
  colors,
  fontWeight,
  radius,
  spacing,
  textStyle,
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
  stepCounter: textStyle('metadataText', colors.textSoft, fontWeight.strong),
  stepCopy: {
    marginBottom: 14,
    gap: 4,
  },
  stepTitle: textStyle('title', colors.text),
  stepDescription: textStyle('bodyText', colors.textMuted),
  helperCard: {
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.card,
  },
  helperCardTitle: textStyle('labelText', colors.text),
  helperCardText: textStyle('captionText', colors.textMuted),
  selectionMeta: textStyle('metadataText', colors.textSoft),
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
    padding: spacing.card,
  },
  loadingCardBody: {
    flex: 1,
    gap: 2,
  },
  loadingCardTitle: textStyle('labelText', colors.text),
  loadingCardText: textStyle('captionText', colors.textMuted),
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
    padding: spacing.card,
  },
  emailInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailInfoLabel: textStyle('labelText', colors.textSoft),
  emailInfoValue: textStyle('bodyText', colors.text, fontWeight.strong),
  emailInfoText: textStyle('captionText', colors.textMuted),
  successCard: {
    gap: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.successBg,
    padding: spacing.card,
  },
  successTitle: textStyle('labelText', colors.secondary),
  successText: textStyle('captionText', colors.secondary),
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
    padding: spacing.md,
  },
  blockedUserBody: {
    flex: 1,
  },
  blockedUserName: textStyle('labelText', colors.text),
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
  blockedUserAction: textStyle('labelText', colors.primary),
  savingStatus: {
    ...typography.captionText,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
