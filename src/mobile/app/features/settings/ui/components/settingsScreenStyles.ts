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
    gap: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  sectionTitle: {
    marginTop: spacing.md,
    ...typography.labelText,
    color: colors.textSoft,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  stepCounter: textStyle('metadataText', colors.textSoft, fontWeight.strong),
  stepCopy: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  stepTitle: textStyle('title', colors.text),
  stepDescription: textStyle('bodyText', colors.textMuted),
  selectionMeta: textStyle('metadataText', colors.textSoft),
  photoSection: {
    alignItems: 'center',
    width: '100%',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.card,
  },
  loadingCardBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  loadingCardTitle: textStyle('labelText', colors.text),
  loadingCardText: textStyle('captionText', colors.textMuted),
  stepActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
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
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    padding: spacing.card,
  },
  emailInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emailInfoLabel: textStyle('labelText', colors.textSoft),
  emailInfoValue: textStyle('bodyText', colors.text, fontWeight.strong),
  emailInfoText: textStyle('captionText', colors.textMuted),
  successCard: {
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.successBg,
    padding: spacing.card,
  },
  successTitle: textStyle('labelText', colors.secondary),
  successText: textStyle('captionText', colors.secondary),
  blockedList: {
    paddingBottom: spacing.lg,
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
    gap: spacing.md,
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
    marginTop: spacing.xxs,
    ...typography.metadataText,
    fontWeight: fontWeight.regular,
    color: colors.textSoft,
  },
  blockedUserBio: {
    marginTop: spacing.xs,
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
