import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CheckCheck, Heart } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  openStackScreen,
  type AppNavigation,
  useAppNavigation,
} from '@/mobile/app/app-shell/navigation/navigation';
import {
  type MobileNotification,
  type NotificationCategory,
  useNotificationsScreenState,
} from '@/mobile/app/features/notifications/application/useNotificationsScreenState';
import { resolveNotificationTarget } from '@/mobile/app/features/notifications/application/notificationTarget';
import { notificationUiConfig } from '@/mobile/app/features/notifications/ui/notificationUiConfig';
import { NotificationCategoryTabs } from '@/mobile/app/features/notifications/ui/components/NotificationCategoryTabs';
import { NotificationListItem } from '@/mobile/app/features/notifications/ui/components/NotificationListItem';
import { NotificationsEmptyState } from '@/mobile/app/features/notifications/ui/components/NotificationsEmptyState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { StackScreenHeader } from '@/mobile/app/shared/components/navigation/StackScreenHeader';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { NotificationListSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';
import { colors, iconSize, spacing } from '@/mobile/app/shared/theme/tokens';
import { buildAdaptiveFlatListProps } from '@/mobile/app/shared/utils/flatList';

const categories: Array<{ key: NotificationCategory; label: string }> = [
  { key: 'all', label: notificationUiConfig.categories.all },
  { key: 'likes', label: notificationUiConfig.categories.likes },
  { key: 'follows', label: notificationUiConfig.categories.follows },
  { key: 'comments', label: notificationUiConfig.categories.comments },
  { key: 'quotes', label: notificationUiConfig.categories.quotes },
  { key: 'places', label: notificationUiConfig.categories.places },
];

export function NotificationsScreen() {
  const navigation = useAppNavigation();
  const { height, width } = useWindowDimensions();
  const { user } = useAuth();
  const {
    category,
    errorMessage,
    fetchNextPage,
    filteredItems,
    hasNextPage,
    isInitialLoading,
    isFetchingNextPage,
    isMarkingAllRead,
    markAllItemsRead,
    markItemRead,
    onRefresh,
    pendingFollowRequestIds,
    refreshing,
    respondToFollowRequest,
    retry,
    setCategory,
    unreadCount,
  } = useNotificationsScreenState({ userId: user?.id });
  useScreenPerformanceMetric({
    hasContent: filteredItems.length > 0,
    hasError: Boolean(errorMessage),
    isLoading: isInitialLoading,
    screen: 'notifications',
  });
  const listProps = React.useMemo(
    () =>
      buildAdaptiveFlatListProps({
        itemCount: filteredItems.length,
        viewportHeight: height,
        viewportWidth: width,
      }),
    [filteredItems.length, height, width],
  );
  const handleNotificationPress = React.useCallback(
    (notification: MobileNotification) => {
      const opened = openNotificationTarget(notification, navigation);

      if (!opened && notification.type !== 'system_announcement') {
        showToast(tr.notifications.targetUnavailable, 'error');
      }
      if (!notification.read) {
        void markItemRead(notification);
      }
    },
    [markItemRead, navigation],
  );
  const handleMarkAllRead = React.useCallback(() => {
    void markAllItemsRead()
      .then(() => showToast(tr.notifications.toast.allRead, 'success'))
      .catch(() => showToast(tr.notifications.toast.markAllFailed, 'error'));
  }, [markAllItemsRead]);
  const handleFollowRequestDecision = React.useCallback(
    (notification: MobileNotification, decision: 'accept' | 'reject') => {
      void respondToFollowRequest(notification, decision)
        .then(() => {
          showToast(
            decision === 'accept'
              ? notificationUiConfig.toast.followRequestAccepted
              : notificationUiConfig.toast.followRequestRejected,
            'success',
          );
        })
        .catch(() => showToast(tr.common.unexpectedError, 'error'));
    },
    [respondToFollowRequest],
  );
  const renderNotification = React.useCallback(
    ({ item: notification }: { item: MobileNotification }) => (
      <NotificationListItem
        notification={notification}
        followRequestPending={pendingFollowRequestIds.has(notification.id)}
        onPress={handleNotificationPress}
        onFollowRequestDecision={handleFollowRequestDecision}
      />
    ),
    [handleFollowRequestDecision, handleNotificationPress, pendingFollowRequestIds],
  );

  if (isInitialLoading) {
    return (
      <Screen padded={false} scroll={false}>
        <NotificationListSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
      padded={false}
      scroll={false}
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
    >
      {/* The same header every stack screen uses. The brand logo it used to
          repeat belongs to the tab screens' app bar, not a screen reached
          from it. */}
      <StackScreenHeader
        onBack={() => navigation.goBack()}
        title={notificationUiConfig.title}
        subtitle={
          unreadCount > 0
            ? notificationUiConfig.newCount(unreadCount)
            : tr.notifications.resultCount(filteredItems.length)
        }
        rightAction={
          <IconButton
            accessibilityLabel={
              unreadCount > 0
                ? `${notificationUiConfig.markAllReadLabel}, ${tr.notifications.unreadHint(unreadCount)}`
                : notificationUiConfig.markAllReadLabel
            }
            disabled={unreadCount === 0}
            loading={isMarkingAllRead}
            onPress={handleMarkAllRead}
          >
            <CheckCheck
              color={unreadCount === 0 ? colors.textDisabled : colors.primary}
              size={iconSize.md}
            />
          </IconButton>
        }
      />

      <NotificationCategoryTabs
        tabs={categories}
        activeKey={category}
        resultCount={filteredItems.length}
        onChange={(nextCategory) => setCategory(nextCategory as NotificationCategory)}
      />

      <FlatList
        {...listProps}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={[
          styles.list,
          filteredItems.length === 0 ? styles.listEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        ListEmptyComponent={
          errorMessage ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={<Heart color={colors.danger} size={iconSize.lg} />}
                title={notificationUiConfig.errorTitle}
                description={errorMessage}
                actionLabel={tr.common.retry}
                onAction={retry}
                tone="danger"
              />
            </View>
          ) : (
            <NotificationsEmptyState
              title={notificationUiConfig.emptyTitle}
              description={notificationUiConfig.emptyDescription}
            />
          )
        }
        ListHeaderComponent={
          errorMessage && filteredItems.length > 0 ? (
            <View style={styles.noticeWrap}>
              <InlineNotice
                tone="warning"
                title={notificationUiConfig.partialTitle}
                description={notificationUiConfig.partialDescription}
                actionLabel={tr.common.retry}
                onAction={() => {
                  void retry();
                }}
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View
              accessible
              accessibilityLabel={tr.common.loadingMore}
              accessibilityLiveRegion="polite"
              accessibilityRole="progressbar"
              accessibilityState={{ busy: true }}
              style={styles.listFooter}
            >
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function openNotificationTarget(
  notification: MobileNotification,
  navigation: AppNavigation,
): boolean {
  const target = resolveNotificationTarget(notification);
  if (target?.screen === 'UserProfile') {
    openStackScreen(navigation, 'UserProfile', target.params);
    return true;
  } else if (target?.screen === 'ListDetail') {
    openStackScreen(navigation, 'ListDetail', target.params);
    return true;
  }

  return false;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
  },
  screenContent: {
    paddingBottom: 0,
  },
  list: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
  },
  emptyWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing['2xl'],
  },
  noticeWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
});
