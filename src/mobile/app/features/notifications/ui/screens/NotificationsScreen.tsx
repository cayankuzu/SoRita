import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  type NotificationCategory,
  useNotificationsScreenState,
} from '@/mobile/app/features/notifications/application/useNotificationsScreenState';
import { notificationUiConfig } from '@/mobile/app/features/notifications/ui/notificationUiConfig';
import { NotificationCategoryTabs } from '@/mobile/app/features/notifications/ui/components/NotificationCategoryTabs';
import { NotificationListItem } from '@/mobile/app/features/notifications/ui/components/NotificationListItem';
import { NotificationsEmptyState } from '@/mobile/app/features/notifications/ui/components/NotificationsEmptyState';
import { showToast } from '@/mobile/app/platform/feedback/toast';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { Screen } from '@/mobile/app/shared/components/ui/Screen';
import { colors } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';

const categories: Array<{ key: NotificationCategory; label: string }> = [
  { key: 'all', label: notificationUiConfig.categories.all },
  { key: 'likes', label: notificationUiConfig.categories.likes },
  { key: 'follows', label: notificationUiConfig.categories.follows },
  { key: 'comments', label: notificationUiConfig.categories.comments },
  { key: 'places', label: notificationUiConfig.categories.places },
];

export function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const {
    category,
    filteredItems,
    markItemRead,
    onRefresh,
    refreshing,
    respondToFollowRequest,
    setCategory,
    unreadCount,
  } = useNotificationsScreenState({ userId: user?.id });

  return (
    <Screen
      padded={false}
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.brandBar}>
        <SoRitaLogo size="sm" />
      </View>

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={colors.textMuted} size={20} />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.title}>{notificationUiConfig.title}</Text>
          {unreadCount > 0 ? <Text style={styles.subtitle}>{notificationUiConfig.newCount(unreadCount)}</Text> : null}
        </View>
      </View>

      <NotificationCategoryTabs
        tabs={categories}
        activeKey={category}
        onChange={(nextCategory) => setCategory(nextCategory as NotificationCategory)}
      />

      {filteredItems.length === 0 ? (
        <NotificationsEmptyState title={notificationUiConfig.emptyTitle} description={notificationUiConfig.emptyDescription} />
      ) : (
        <View style={styles.list}>
          {filteredItems.map((notification) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              onPress={() => {
                void (async () => {
                  await markItemRead(notification);
                  openNotificationTarget(notification, navigation);
                })();
              }}
              onAcceptFollowRequest={() =>
                void (async () => {
                  await respondToFollowRequest(notification, 'accept');
                  showToast('Takip istegi onaylandi', 'success');
                })()
              }
              onRejectFollowRequest={() =>
                void (async () => {
                  await respondToFollowRequest(notification, 'reject');
                  showToast('Takip istegi reddedildi', 'success');
                })()
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function openNotificationTarget(
  notification: import('@/mobile/app/data/repositories/notificationRepository').MobileNotification,
  navigation: any,
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
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
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
  list: {
    backgroundColor: colors.surface,
  },
});
