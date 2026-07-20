import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, Heart } from 'lucide-react-native';

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
import { notificationUiConfig } from '@/mobile/app/features/notifications/ui/notificationUiConfig';
import { NotificationCategoryTabs } from '@/mobile/app/features/notifications/ui/components/NotificationCategoryTabs';
import { NotificationListItem } from '@/mobile/app/features/notifications/ui/components/NotificationListItem';
import { NotificationsEmptyState } from '@/mobile/app/features/notifications/ui/components/NotificationsEmptyState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { EmptyState } from '@/mobile/app/shared/components/ui/EmptyState';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { useScreenPerformanceMetric } from '@/mobile/app/shared/performance/useScreenPerformanceMetric';
import { colors } from '@/mobile/app/shared/theme/tokens';
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

  if (isInitialLoading) {
    return (
      <Screen padded={false} scroll={false}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
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
      <View style={styles.brandBar}>
        <SoRitaLogo size="sm" />
      </View>

      <View style={styles.header}>
        <Pressable
          accessibilityLabel={tr.common.back}
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft color={colors.textMuted} size={20} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title}>{notificationUiConfig.title}</Text>
          {unreadCount > 0 ? <Text style={styles.subtitle}>{notificationUiConfig.newCount(unreadCount)}</Text> : null}
        </View>
        <Pressable
          accessibilityLabel={notificationUiConfig.markAllReadLabel}
          accessibilityRole="button"
          disabled={unreadCount === 0 || isMarkingAllRead}
          onPress={() => {
            void markAllItemsRead();
          }}
          style={({ pressed }) => [
            styles.markAllButton,
            unreadCount === 0 || isMarkingAllRead ? styles.markAllButtonDisabled : null,
            pressed && unreadCount > 0 && !isMarkingAllRead ? styles.markAllButtonPressed : null,
          ]}
        >
          <Text
            style={[
              styles.markAllButtonLabel,
              unreadCount === 0 || isMarkingAllRead ? styles.markAllButtonLabelDisabled : null,
            ]}
          >
            {notificationUiConfig.markAllReadLabel}
          </Text>
        </Pressable>
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
        renderItem={({ item: notification }) => (
          <NotificationListItem
            notification={notification}
            onPress={() => {
              void (async () => {
                if (!notification.read) {
                  await markItemRead(notification);
                }

                openNotificationTarget(notification, navigation);
              })();
            }}
            onAcceptFollowRequest={() =>
              void (async () => {
                await respondToFollowRequest(notification, 'accept');
                showToast(notificationUiConfig.toast.followRequestAccepted, 'success');
              })()
            }
            onRejectFollowRequest={() =>
              void (async () => {
                await respondToFollowRequest(notification, 'reject');
                showToast(notificationUiConfig.toast.followRequestRejected, 'success');
              })()
            }
          />
        )}
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
                icon={<Heart color={colors.danger} size={28} />}
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
  if (!notification.linkTo) {
    openStackScreen(navigation, 'UserProfile', { userId: notification.userId });
    return;
  }

  if (notification.linkTo.type === 'profile') {
    openStackScreen(navigation, 'UserProfile', { userId: notification.linkTo.userId });
    return;
  }

  openStackScreen(navigation, 'ListDetail', {
    listId: notification.linkTo.listId,
    placeId: notification.linkTo.placeId,
  });
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
  },
  screenContent: {
    paddingBottom: 0,
  },
  brandBar: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.surface,
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
  markAllButton: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 999,
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
  markAllButtonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  markAllButtonLabelDisabled: {
    color: colors.textSoft,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
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
    paddingBottom: 12,
  },
  listEmpty: {
    flexGrow: 1,
  },
  emptyWrap: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },
  noticeWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  listFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
});
