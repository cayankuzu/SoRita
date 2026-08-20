import React from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, CheckCheck, Heart } from 'lucide-react-native';

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
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { NotificationListSkeleton } from '@/mobile/app/shared/components/ui/SkeletonPlaceholder';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';
import { colors, radius, touch, typography } from '@/mobile/app/shared/theme/tokens';
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
      openNotificationTarget(notification, navigation);
      if (!notification.read) {
        void markItemRead(notification);
      }
    },
    [markItemRead, navigation],
  );
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
      <View style={styles.header}>
        <IconButton
          accessibilityLabel={tr.common.back}
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.textMuted} size={18} />
        </IconButton>
        <View style={styles.headerBody}>
          <View style={styles.headerTitleRow}>
            <SoRitaLogo size="sm" showIcon={false} showTagline={false} />
            <View style={styles.headerTitleDivider} />
            <Text style={styles.title}>{notificationUiConfig.title}</Text>
          </View>
          {unreadCount > 0 ? <Text style={styles.subtitle}>{notificationUiConfig.newCount(unreadCount)}</Text> : null}
        </View>
        <InstantPressable
          accessibilityLabel={notificationUiConfig.markAllReadLabel}
          accessibilityRole="button"
          disabled={unreadCount === 0 || isMarkingAllRead}
          onPress={markAllItemsRead}
          style={({ pressed }) => [
            styles.markAllButton,
            unreadCount === 0 || isMarkingAllRead ? styles.markAllButtonDisabled : null,
            pressed && unreadCount > 0 && !isMarkingAllRead ? styles.markAllButtonPressed : null,
          ]}
        >
          <CheckCheck
            color={unreadCount === 0 || isMarkingAllRead ? colors.textDisabled : colors.primary}
            size={18}
          />
        </InstantPressable>
      </View>

      <NotificationCategoryTabs
        tabs={categories}
        activeKey={category}
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
                icon={<Heart color={colors.danger} size={24} />}
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
            <View style={styles.listFooter}>
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
) {
  const target = resolveNotificationTarget(notification);
  if (target?.screen === 'UserProfile') {
    openStackScreen(navigation, 'UserProfile', target.params);
  } else if (target?.screen === 'ListDetail') {
    openStackScreen(navigation, 'ListDetail', target.params);
  }
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
  },
  screenContent: {
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 56,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitleDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.cardBorder,
  },
  markAllButton: {
    width: Platform.OS === 'ios' ? touch.ios : touch.android,
    height: Platform.OS === 'ios' ? touch.ios : touch.android,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryBg,
  },
  markAllButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  markAllButtonPressed: {
    opacity: 0.82,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    ...typography.metadataText,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    backgroundColor: colors.surface,
    paddingBottom: 10,
  },
  listEmpty: {
    flexGrow: 1,
  },
  emptyWrap: {
    paddingHorizontal: 12,
    paddingTop: 22,
  },
  noticeWrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
