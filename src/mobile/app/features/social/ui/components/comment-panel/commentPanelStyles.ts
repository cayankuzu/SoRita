import { StyleSheet } from 'react-native';

import { colors, radius } from '@/mobile/app/shared/theme/tokens';

export const commentPanelStyles = StyleSheet.create({
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheetKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  commentSheet: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    height: '84%',
    maxHeight: '92%',
    minHeight: '84%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  innerSheetCard: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  handle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.cardBorder,
    marginTop: 10,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  sheetSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textSoft,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  sheetBody: {
    flex: 1,
  },
  commentScroll: {
    flex: 1,
  },
  commentScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 18,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 32,
  },
  emptyCommentsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  emptyCommentsDescription: {
    fontSize: 13,
    color: colors.textSoft,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  loadMoreLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  replyCommentItem: {
    marginTop: 12,
  },
  commentAvatarButton: {
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  commentMain: {
    flex: 1,
    gap: 8,
  },
  commentTopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  commentIdentity: {
    flex: 1,
    gap: 2,
  },
  commentAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  commentMeta: {
    fontSize: 12,
    color: colors.textSoft,
  },
  commentEdited: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
  commentLikeColumn: {
    width: 28,
    alignItems: 'center',
    gap: 4,
  },
  commentLikeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentLikeCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSoft,
  },
  commentLikeCountActive: {
    color: colors.danger,
  },
  commentContent: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  mentionText: {
    color: colors.primary,
    fontWeight: '700',
  },
  commentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  commentInlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  commentInlineActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  commentInlineActionTextActive: {
    color: colors.primary,
  },
  commentInlineDangerText: {
    color: colors.danger,
  },
  replySection: {
    gap: 10,
  },
  replyThread: {
    marginLeft: 6,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.cardBorder,
  },
  replyToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  replyToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSoft,
  },
  composerDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    paddingTop: 8,
    gap: 8,
    backgroundColor: colors.surface,
  },
  reactionRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 2,
  },
  reactionButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  reactionEmoji: {
    fontSize: 22,
  },
  composerBanner: {
    marginHorizontal: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.primaryBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  composerBannerAction: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
  },
  composerInputWrap: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  commentInput: {
    fontSize: 15,
    color: colors.text,
    padding: 0,
    margin: 0,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  disabledAction: {
    opacity: 0.55,
  },
});
