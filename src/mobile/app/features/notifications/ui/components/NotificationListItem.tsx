import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { MobileNotification } from '@/mobile/app/features/notifications/application/useNotificationsScreenState';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { Badge } from '@/mobile/app/shared/components/ui/Badge';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { AvatarView } from '@/mobile/app/shared/components/ui/AvatarView';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  avatarSize,
  colors,
  fontWeight,
  minTouchSize,
  opacity,
  radius,
  spacing,
  textStyle,
  typography,
} from '@/mobile/app/shared/theme/tokens';

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
  const accessibilityLabel = [
    notification.userName,
    notification.message,
    notification.timestamp,
    notification.read ? tr.notifications.read : tr.notifications.unread,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={[styles.row, !notification.read ? styles.rowUnread : null]}>
      <InstantPressable
        accessibilityHint={tr.notifications.openHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ busy: followRequestPending }}
        onPress={() => onPress(notification)}
        style={styles.mainAction}
      >
        <View style={styles.avatarWrap}>
          <AvatarView uri={notification.userPhoto} name={notification.userName} size={avatarSize.md} />
        </View>

        <View style={styles.body}>
          <AppText style={styles.message}>
            <AppText style={styles.messageStrong}>{notification.userName} </AppText>
            <AppText style={styles.messageMuted}>{notification.message}</AppText>
          </AppText>
          <AppText style={styles.timestamp}>{notification.timestamp}</AppText>
          {isResolvedFollowRequest ? (
            <Badge
              label={
                notification.followRequest?.status === 'accepted'
                  ? tr.notifications.status.accepted
                  : tr.notifications.status.rejected
              }
              style={styles.statusBadge}
              tone={notification.followRequest?.status === 'accepted' ? 'success' : 'neutral'}
            />
          ) : null}
        </View>

        {!notification.read ? <View style={styles.unreadDot} /> : null}
      </InstantPressable>

      {isPendingFollowRequest ? (
        followRequestPending ? (
          <View
            accessible
            accessibilityLabel={tr.notifications.processingRequest}
            accessibilityLiveRegion="polite"
            accessibilityRole="progressbar"
            accessibilityState={{ busy: true }}
            style={styles.pendingRow}
          >
            <ActivityIndicator color={colors.primary} size="small" />
            <AppText style={styles.pendingLabel}>{tr.notifications.processingRequest}</AppText>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <InstantPressable
              accessibilityLabel={tr.notifications.reject}
              accessibilityRole="button"
              accessibilityState={{ disabled: followRequestPending }}
              disabled={followRequestPending}
              onPress={() => onFollowRequestDecision?.(notification, 'reject')}
              style={[
                styles.actionButton,
                styles.rejectButton,
                followRequestPending ? styles.actionButtonDisabled : null,
              ]}
            >
              <AppText style={[styles.actionLabel, styles.rejectLabel]}>{tr.notifications.reject}</AppText>
            </InstantPressable>
            <InstantPressable
              accessibilityLabel={tr.notifications.accept}
              accessibilityRole="button"
              accessibilityState={{ disabled: followRequestPending }}
              disabled={followRequestPending}
              onPress={() => onFollowRequestDecision?.(notification, 'accept')}
              style={[
                styles.actionButton,
                styles.acceptButton,
                followRequestPending ? styles.actionButtonDisabled : null,
              ]}
            >
              <AppText style={[styles.actionLabel, styles.acceptLabel]}>{tr.notifications.accept}</AppText>
            </InstantPressable>
          </View>
        )
      ) : null}
    </View>
  );
}

export const NotificationListItem = React.memo(NotificationListItemComponent);

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  mainAction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: minTouchSize,
  },
  rowUnread: {
    backgroundColor: colors.primaryBg,
  },
  avatarWrap: {
    width: 40,
    paddingTop: spacing.xxs,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  message: {
    ...typography.bodyText,
  },
  messageStrong: {
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  messageMuted: {
    color: colors.textMuted,
  },
  timestamp: {
    marginTop: spacing.xs,
    ...typography.metadataText,
    color: colors.textSoft,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: 50,
    marginTop: spacing.sm,
  },
  actionButton: {
    minWidth: 70,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonDisabled: {
    opacity: opacity.disabled,
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
    ...typography.labelText,
  },
  acceptLabel: {
    color: colors.onPrimary,
  },
  rejectLabel: {
    color: colors.textMuted,
  },
  statusBadge: {
    marginTop: spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pendingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: 50,
    marginTop: spacing.sm,
    minHeight: minTouchSize,
  },
  pendingLabel: textStyle('captionText', colors.textMuted),
});
