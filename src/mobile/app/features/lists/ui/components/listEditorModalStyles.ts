import { Platform, StyleSheet } from 'react-native';

import { colors, radius, touch, typography } from '@/mobile/app/shared/theme/tokens';

const MIN_TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;

export const listEditorModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  panel: {
    width: '100%',
    maxWidth: 648,
    alignSelf: 'center',
    maxHeight: '86%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerText: {
    flex: 1,
  },
  headerMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSoft,
  },
  closeButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sectionCard: {
    gap: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  sectionHint: {
    flexShrink: 1,
    textAlign: 'right',
    ...typography.metadataText,
    color: colors.textSoft,
  },
  visibilityChip: {
    minHeight: 28,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  visibilityChipPublic: {
    backgroundColor: colors.successBg,
    borderColor: colors.successBorder,
  },
  visibilityChipPrivate: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
  },
  visibilityChipText: {
    ...typography.metadataText,
    fontWeight: '700',
  },
  visibilityChipTextPublic: {
    color: colors.secondary,
  },
  visibilityChipTextPrivate: {
    color: colors.visibilityPrivate,
  },
  coverPickerRow: {
    width: '100%',
    gap: 8,
  },
  coverClearButton: {
    alignSelf: 'flex-end',
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkOverlay,
  },
  coverPicker: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.secondary,
    backgroundColor: colors.successBg,
    gap: 10,
    padding: 10,
  },
  coverPickerSelected: {
    backgroundColor: colors.surface,
  },
  coverPickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  coverPickerHeaderCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  coverPickerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  coverPickerBody: {
    flex: 1,
    gap: 3,
  },
  coverPickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  coverPickerHint: {
    ...typography.metadataText,
    color: colors.textMuted,
  },
  selectionBadge: {
    minHeight: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  selectionBadgeText: {
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.textMuted,
  },
  fieldCount: {
    marginTop: -4,
    alignSelf: 'flex-end',
    ...typography.metadataText,
    color: colors.textSoft,
  },
  privacyRow: {
    gap: 8,
  },
  privacyButton: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.surfaceMuted,
  },
  privacyButtonActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.infoBorder,
  },
  privateButtonActive: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.infoBorder,
  },
  privacyButtonBody: {
    flex: 1,
    gap: 4,
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  privacyTextActivePublic: {
    color: colors.primary,
  },
  privacyTextActivePrivate: {
    color: colors.primary,
  },
  privacyCaption: {
    ...typography.metadataText,
    color: colors.textMuted,
  },
  privacyCaptionActivePublic: {
    color: colors.primaryDark,
  },
  privacyCaptionActivePrivate: {
    color: colors.primaryDark,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  footerButton: {
    flex: 1,
  },
});
