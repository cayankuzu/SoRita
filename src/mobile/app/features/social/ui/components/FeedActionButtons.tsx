import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import {
  Crosshair,
  Ellipsis,
  Flag,
  Heart,
  ListPlus,
  MapPin,
  MessageCircle,
  Share2,
} from 'lucide-react-native';

import { MINI_MAP_RESET_LONG_PRESS_MS } from '@/mobile/app/shared/components/maps/useMiniMapInteraction';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { triggerHaptic } from '@/mobile/app/shared/hooks/useHaptic';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type FeedActionButtonsProps = {
  commentCount: number;
  focusActionActive: boolean;
  likeCount: number;
  liked: boolean;
  locationAvailable: boolean;
  onAddToListPress?: () => void;
  onCommentPress: () => void;
  onCommentsIntent: () => void;
  onFocusLongPress?: () => void;
  onFocusPress?: () => void;
  onLikePress: () => void;
  onLikersPress: () => void;
  onOverflowPress?: () => void;
  onReportPress: () => void;
  onSharePress?: () => void;
  onToggleAddress: () => void;
  overflowActionLabel: string;
  showAddToList: boolean;
  showAddress: boolean;
  showCommentAction: boolean;
  showComments: boolean;
  showOverflowAction: boolean;
  showReportAction: boolean;
  showReportSheet: boolean;
  showShareAction: boolean;
};

function LikeAction(props: Pick<FeedActionButtonsProps, 'liked' | 'likeCount' | 'onLikePress' | 'onLikersPress'>) {
  return (
    <InstantPressable
      accessibilityLabel={props.liked ? tr.cards.unlikeAction : tr.cards.likeAction}
      accessibilityRole="button"
      accessibilityState={{ selected: props.liked }}
      style={[styles.actionButton, props.liked ? styles.likeActionActive : null]}
      onPress={() => {
        triggerHaptic('light');
        props.onLikePress();
      }}
      onLongPress={props.onLikersPress}
      delayLongPress={500}
    >
      <Heart
        size={18}
        color={props.liked ? colors.danger : colors.textMuted}
        fill={props.liked ? colors.danger : 'transparent'}
      />
      {props.likeCount > 0 ? (
        <Text style={[styles.actionCount, props.liked ? styles.actionCountLiked : null]}>
          {props.likeCount}
        </Text>
      ) : null}
    </InstantPressable>
  );
}

function CommentAction(props: Pick<
  FeedActionButtonsProps,
  'commentCount' | 'onCommentPress' | 'onCommentsIntent' | 'showComments'
>) {
  return (
    <InstantPressable
      accessibilityLabel={tr.cards.commentAction}
      accessibilityRole="button"
      accessibilityState={{ expanded: props.showComments }}
      style={[styles.actionButton, props.showComments ? styles.primaryActionActive : null]}
      onPressIn={props.onCommentsIntent}
      onPress={props.onCommentPress}
    >
      <MessageCircle size={18} color={props.showComments ? colors.primary : colors.textMuted} />
      {props.commentCount > 0 ? (
        <Text style={[styles.actionCount, props.showComments ? styles.actionCountPrimary : null]}>
          {props.commentCount}
        </Text>
      ) : null}
    </InstantPressable>
  );
}

function FocusAction(props: Pick<
  FeedActionButtonsProps,
  'focusActionActive' | 'onFocusLongPress' | 'onFocusPress'
>) {
  const handledLongPressRef = React.useRef(false);

  return (
    <InstantPressable
      accessibilityLabel={tr.cards.focusMiniMap}
      accessibilityRole="button"
      style={[styles.actionButton, props.focusActionActive ? styles.primaryActionActive : null]}
      delayLongPress={MINI_MAP_RESET_LONG_PRESS_MS}
      onPressIn={() => {
        handledLongPressRef.current = false;
      }}
      onPress={() => {
        if (handledLongPressRef.current) {
          handledLongPressRef.current = false;
          return;
        }

        props.onFocusPress?.();
      }}
      onLongPress={() => {
        handledLongPressRef.current = true;
        props.onFocusLongPress?.();
      }}
    >
      <Crosshair size={18} color={props.focusActionActive ? colors.primary : colors.textMuted} />
    </InstantPressable>
  );
}

export function FeedActionButtons(props: FeedActionButtonsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
      <LikeAction {...props} />

      {props.showCommentAction ? (
        <CommentAction {...props} />
      ) : null}

      {props.showShareAction && props.onSharePress ? (
        <InstantPressable
          accessibilityLabel={tr.cards.share}
          accessibilityRole="button"
          style={styles.actionButton}
          onPress={props.onSharePress}
        >
          <Share2 size={18} color={colors.textMuted} />
        </InstantPressable>
      ) : null}

      {props.onFocusPress ? (
        <FocusAction {...props} />
      ) : null}

      {props.showAddToList ? (
        <InstantPressable
          accessibilityLabel={tr.cards.addToListAction}
          accessibilityRole="button"
          style={styles.actionButton}
          onPress={props.onAddToListPress}
        >
          <ListPlus size={18} color={colors.textMuted} />
        </InstantPressable>
      ) : null}

      {props.locationAvailable ? (
        <InstantPressable
          accessibilityLabel={tr.cards.showAddressAction}
          accessibilityRole="button"
          accessibilityState={{ expanded: props.showAddress }}
          style={[styles.actionButton, props.showAddress ? styles.successActionActive : null]}
          onPress={props.onToggleAddress}
        >
          <MapPin size={18} color={props.showAddress ? colors.secondary : colors.textMuted} />
        </InstantPressable>
      ) : null}

      {props.showOverflowAction && props.onOverflowPress ? (
        <InstantPressable
          accessibilityLabel={props.overflowActionLabel}
          accessibilityRole="button"
          style={styles.actionButton}
          onPress={props.onOverflowPress}
        >
          <Ellipsis size={18} color={colors.textMuted} />
        </InstantPressable>
      ) : null}

      {props.showReportAction ? (
        <InstantPressable
          accessibilityLabel={tr.cards.reportAction}
          accessibilityRole="button"
          style={[styles.actionButton, props.showReportSheet ? styles.warningActionActive : null]}
          onPress={props.onReportPress}
        >
          <Flag size={18} color={props.showReportSheet ? colors.warning : colors.textMuted} />
        </InstantPressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  actionButton: {
    minWidth: 44,
    height: 38,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  actionCountLiked: { color: colors.danger },
  actionCountPrimary: { color: colors.primary },
  likeActionActive: { backgroundColor: colors.dangerBg },
  primaryActionActive: { backgroundColor: colors.primaryBg },
  successActionActive: { backgroundColor: colors.successBg },
  warningActionActive: { backgroundColor: colors.warningBg },
});
