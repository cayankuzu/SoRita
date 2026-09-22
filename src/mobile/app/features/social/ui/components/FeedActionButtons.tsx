import React from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import {
  Ellipsis,
  Heart,
  MessageCircle,
  Share2,
} from 'lucide-react-native';

import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { triggerHaptic } from '@/mobile/app/shared/hooks/useHaptic';
import { useReduceMotion } from '@/mobile/app/shared/hooks/useReduceMotion';
import {
  colors,
  iconSize,
  spacing,
  textStyle,
  touch,
} from '@/mobile/app/shared/theme/tokens';

type FeedActionButtonsProps = {
  commentCount: number;
  likeCount: number;
  liked: boolean;
  onCommentPress: () => void;
  onCommentsIntent: () => void;
  onLikePress: () => void | Promise<void>;
  onLikersPress: () => void;
  onOverflowPress?: () => void;
  onSharePress?: () => void;
  overflowActionLabel: string;
  showCommentAction: boolean;
  showComments: boolean;
  showOverflowAction: boolean;
  showShareAction: boolean;
};

const TOUCH_SIZE = Platform.OS === 'ios' ? touch.ios : touch.android;

// A like answers with a short pop, the one bit of motion a feed earns: it
// confirms the tap before the network does. Reduce Motion skips it.
function useLikePop(liked: boolean) {
  const reduceMotion = useReduceMotion();
  const scale = React.useRef(new Animated.Value(1)).current;
  const wasLiked = React.useRef(liked);

  React.useEffect(() => {
    const becameLiked = liked && !wasLiked.current;
    wasLiked.current = liked;
    if (!becameLiked || reduceMotion) {
      return;
    }
    scale.setValue(0.8);
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [liked, reduceMotion, scale]);

  return scale;
}

function LikeAction(props: Pick<FeedActionButtonsProps, 'liked' | 'likeCount' | 'onLikePress' | 'onLikersPress'>) {
  const scale = useLikePop(props.liked);

  return (
    <View style={styles.group}>
      <InstantPressable
        accessibilityLabel={props.liked ? tr.cards.unlikeAction : tr.cards.likeAction}
        accessibilityRole="button"
        accessibilityState={{ selected: props.liked }}
        style={styles.iconButton}
        onPress={() => {
          triggerHaptic('light');
          return props.onLikePress();
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Heart
            size={iconSize.lg}
            color={props.liked ? colors.danger : colors.text}
            fill={props.liked ? colors.danger : 'transparent'}
          />
        </Animated.View>
      </InstantPressable>

      <InstantPressable
        accessibilityHint={tr.cards.likedBy}
        accessibilityLabel={`${tr.cards.likedBy}: ${props.likeCount}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: props.likeCount === 0 }}
        disabled={props.likeCount === 0}
        style={styles.countButton}
        onPress={props.onLikersPress}
      >
        <AppText accessible={false} style={styles.count}>
          {props.likeCount}
        </AppText>
      </InstantPressable>
    </View>
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
      style={styles.iconWithCountButton}
      onPressIn={props.onCommentsIntent}
      onPress={props.onCommentPress}
    >
      <MessageCircle size={iconSize.lg} color={props.showComments ? colors.primary : colors.text} />
      {props.commentCount > 0 ? (
        <AppText accessible={false} style={styles.count}>
          {props.commentCount}
        </AppText>
      ) : null}
    </InstantPressable>
  );
}

/**
 * Like with its count, comment with its count and share sit together on the
 * left; the content menu sits alone on the right. Counts stand right beside
 * their icon instead of in a cell of their own, and the row carries no rule
 * above it, so the card reads as one piece.
 */
export function FeedActionButtons(props: FeedActionButtonsProps) {
  return (
    <View style={styles.actions}>
      <LikeAction {...props} />

      {props.showCommentAction ? (
        <CommentAction {...props} />
      ) : null}

      {props.showShareAction && props.onSharePress ? (
        <InstantPressable
          accessibilityLabel={tr.cards.share}
          accessibilityRole="button"
          style={styles.iconButton}
          onPress={props.onSharePress}
        >
          <Share2 size={iconSize.lg} color={colors.text} />
        </InstantPressable>
      ) : null}

      {props.showOverflowAction && props.onOverflowPress ? (
        <InstantPressable
          accessibilityLabel={props.overflowActionLabel}
          accessibilityRole="button"
          style={[styles.iconButton, styles.trailing]}
          onPress={props.onOverflowPress}
        >
          <Ellipsis size={iconSize.lg} color={colors.textMuted} />
        </InstantPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The first icon's glyph lines up with the card's 12dp content edge: a 48dp
  // button centres a 24dp icon 12dp in from its own left edge.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    minWidth: TOUCH_SIZE,
    minHeight: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWithCountButton: {
    minWidth: TOUCH_SIZE,
    minHeight: TOUCH_SIZE,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  // The count's own target tucks 4dp under the heart's, so the number sits
  // 8dp from the glyph instead of floating in a cell of its own, and still
  // offers a full 48dp to open the likers.
  countButton: {
    minWidth: TOUCH_SIZE,
    minHeight: TOUCH_SIZE,
    marginLeft: -spacing.xs,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  count: textStyle('labelText', colors.text),
  trailing: {
    marginLeft: 'auto',
  },
});
