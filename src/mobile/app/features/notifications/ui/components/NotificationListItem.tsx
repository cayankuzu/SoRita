import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import type { MobileNotification } from '@/mobile/app/features/notifications/application/useNotificationsScreenState';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { colors, radius, typography } from '@/mobile/app/shared/theme/tokens';

type NotificationListItemProps = {
  notification: MobileNotification;
  followRequestPending?: boolean;
  onPress: (notification: MobileNotification) => void;
  onFollowRequestDecision?: (
    notification: MobileNotification,
    decision: 'accept' | 'reject',
  ) => void;
};

function NotificationListItemComponent({
  notification,
  followRequestPending = false,
  onPress,
  onFollowRequestDecision,
}: NotificationListItemProps) {
  const isPendingFollowRequest =
    notification.type === 'follow_request' && notification.followRequest?.status === 'pending';
  const isResolvedFollowRequest =
    notification.type === 'follow_request' &&
    (notification.followRequest?.status === 'accepted' ||
      notification.followRequest?.status === 'rejected');

  return (
    <InstantPressable
      accessibilityRole="button"
      onPress={() => onPress(notification)}
      style={[styles.row, !notification.read ? styles.rowUnread : null]}
    >
      <View style={styles.avatarWrap}>
        <AvatarView uri={notification.userPhoto} name={notification.userName} size={38} />
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
              accessibilityLabel={tr.notifications.reject}
              accessibilityRole="button"
              accessibilityState={{ disabled: followRequestPending }}
              disabled={followRequestPending}
              onPress={(event) => {
                event.stopPropagation();
                onFollowRequestDecision?.(notification, 'reject');
              }}
              style={[
                styles.actionButton,
                styles.rejectButton,
                followRequestPending ? styles.actionButtonDisabled : null,
              ]}
            >
              <Text style={[styles.actionLabel, styles.rejectLabel]}>{tr.notifications.reject}</Text>
            </InstantPressable>
            <InstantPressable
              accessibilityLabel={tr.notifications.accept}
              accessibilityRole="button"
              accessibilityState={{ disabled: followRequestPending }}
              disabled={followRequestPending}
              onPress={(event) => {
                event.stopPropagation();
                onFollowRequestDecision?.(notification, 'accept');
              }}
              style={[
                styles.actionButton,
                styles.acceptButton,
                followRequestPending ? styles.actionButtonDisabled : null,
              ]}
            >
              {followRequestPending ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={[styles.actionLabel, styles.acceptLabel]}>{tr.notifications.accept}</Text>
              )}
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

export const NotificationListItem = React.memo(NotificationListItemComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  rowUnread: {
    backgroundColor: colors.primaryBg,
  },
  avatarWrap: {
    width: 40,
    paddingTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  message: {
    fontSize: 12,
    lineHeight: 18,
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
    ...typography.metadataText,
    color: colors.textSoft,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  actionButton: {
    minWidth: 70,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonDisabled: {
    opacity: 0.62,
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
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  statusLabel: {
    ...typography.metadataText,
    fontWeight: '700',
    color: colors.textSoft,
  },
  unreadDot: {
    width: 8,
    height: 8,
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
