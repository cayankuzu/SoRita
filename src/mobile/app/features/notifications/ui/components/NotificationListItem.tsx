import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Heart, MapPin, MessageCircle, Star, UserPlus } from 'lucide-react-native';

import type { MobileNotification } from '@/mobile/app/features/notifications/application/useNotificationsScreenState';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius } from '@/mobile/app/shared/theme/tokens';

type NotificationListItemProps = {
  notification: MobileNotification;
  onPress: () => void;
  onAcceptFollowRequest?: () => void;
  onRejectFollowRequest?: () => void;
};

const ICON_META = {
  like: {
    backgroundColor: colors.danger,
    icon: <Heart color={colors.onPrimary} size={12} fill={colors.onPrimary} />,
  },
  follow: {
    backgroundColor: colors.primary,
    icon: <UserPlus color={colors.onPrimary} size={12} />,
  },
  follow_request: {
    backgroundColor: colors.primary,
    icon: <UserPlus color={colors.onPrimary} size={12} />,
  },
  comment: {
    backgroundColor: colors.secondary,
    icon: <MessageCircle color={colors.onPrimary} size={12} />,
  },
  comment_like: {
    backgroundColor: colors.danger,
    icon: <Heart color={colors.onPrimary} size={12} fill={colors.onPrimary} />,
  },
  comment_reply: {
    backgroundColor: colors.secondary,
    icon: <MessageCircle color={colors.onPrimary} size={12} />,
  },
  place_added: {
    backgroundColor: colors.purple,
    icon: <MapPin color={colors.onPrimary} size={12} />,
  },
  place_quote: {
    backgroundColor: colors.primary,
    icon: <MapPin color={colors.onPrimary} size={12} />,
  },
  list_liked: {
    backgroundColor: colors.warning,
    icon: <Star color={colors.onPrimary} size={12} fill={colors.onPrimary} />,
  },
} as const;

function NotificationListItemComponent({
  notification,
  onPress,
  onAcceptFollowRequest,
  onRejectFollowRequest,
}: NotificationListItemProps) {
  const iconMeta = ICON_META[notification.type];
  const isPendingFollowRequest =
    notification.type === 'follow_request' && notification.followRequest?.status === 'pending';
  const isResolvedFollowRequest =
    notification.type === 'follow_request' &&
    (notification.followRequest?.status === 'accepted' ||
      notification.followRequest?.status === 'rejected');

  return (
    <InstantPressable
      onPress={onPress}
      style={[styles.row, !notification.read ? styles.rowUnread : null]}
    >
      <View style={styles.avatarWrap}>
        <AvatarView uri={notification.userPhoto} name={notification.userName} size={44} />
        <View style={[styles.iconBubble, { backgroundColor: iconMeta.backgroundColor }]}>
          {iconMeta.icon}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.message}>
          <Text style={styles.messageStrong}>{notification.userName} </Text>
          <Text style={styles.messageMuted}>{notification.message}</Text>
        </Text>
        <Text style={styles.timestamp}>{notification.timestamp}</Text>
        {isPendingFollowRequest ? (
          <View style={styles.actionsRow}>
            <InstantPressable
              onPress={(event) => {
                event.stopPropagation();
                onRejectFollowRequest?.();
              }}
              style={[styles.actionButton, styles.rejectButton]}
            >
              <Text style={[styles.actionLabel, styles.rejectLabel]}>Reddet</Text>
            </InstantPressable>
            <InstantPressable
              onPress={(event) => {
                event.stopPropagation();
                onAcceptFollowRequest?.();
              }}
              style={[styles.actionButton, styles.acceptButton]}
            >
              <Text style={[styles.actionLabel, styles.acceptLabel]}>Onayla</Text>
            </InstantPressable>
          </View>
        ) : null}
        {isResolvedFollowRequest ? (
          <View style={styles.statusBadge}>
            <Text style={styles.statusLabel}>
              {notification.followRequest?.status === 'accepted'
                ? tr.notifications.status.accepted
                : tr.notifications.status.rejected}
            </Text>
          </View>
        ) : null}
      </View>

      {!notification.read ? <View style={styles.unreadDot} /> : null}
    </InstantPressable>
  );
}

function areNotificationListItemPropsEqual(
  previous: NotificationListItemProps,
  next: NotificationListItemProps,
) {
  return previous.notification === next.notification;
}

export const NotificationListItem = React.memo(
  NotificationListItemComponent,
  areNotificationListItemPropsEqual,
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  rowUnread: {
    backgroundColor: colors.primaryBg,
  },
  avatarWrap: {
    position: 'relative',
    width: 46,
    paddingTop: 2,
  },
  iconBubble: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageStrong: {
    fontWeight: '600',
    color: colors.text,
  },
  messageMuted: {
    color: colors.textMuted,
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSoft,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rejectButton: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  acceptLabel: {
    color: colors.onPrimary,
  },
  rejectLabel: {
    color: colors.textMuted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSoft,
  },
  unreadDot: {
    width: 9,
    height: 9,
    marginTop: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
