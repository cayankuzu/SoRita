import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { prioritizeStartupWarmupStage } from '@/mobile/app/app-shell/startup/startupDataWarmup';
import { useNotificationUnreadCountQuery } from '@/mobile/app/data/hooks/useNotificationsQuery';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { AppText } from '@/mobile/app/shared/components/ui/AppText';
import { IconButton } from '@/mobile/app/shared/components/ui/IconButton';
import { logger } from '@/mobile/app/platform/feedback/logger';
import { tr } from '@/mobile/app/shared/i18n/tr';
import {
  colors,
  fontWeight,
  iconSize,
  layout,
  minTouchSize,
  radius,
  spacing,
  tabularNumbers,
  typography,
} from '@/mobile/app/shared/theme/tokens';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { useTopInset } from '@/mobile/app/shared/hooks/useTopInset';

const NOTIFICATION_COUNT_REFRESH_WINDOW_MS = 1000 * 60;

export function AppHeader() {
  const navigation = useAppNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const userId = user?.id;
  const showNotifications = route.name === 'Home';
  const appLayout = useAppLayout();
  const topInset = useTopInset();
  const notificationsQuery = useNotificationUnreadCountQuery(userId, {
    enabled: showNotifications,
  });
  const {
    data: unreadCount,
    dataUpdatedAt,
    isFetching,
    refetch: refetchUnreadCount,
  } = notificationsQuery;
  const hasFocusedOnceRef = useRef(false);

  const loadNotificationCount = useCallback(async () => {
    if (!showNotifications || !userId || isFetching) {
      return;
    }

    const hasFreshData =
      dataUpdatedAt > 0 &&
      Date.now() - dataUpdatedAt < NOTIFICATION_COUNT_REFRESH_WINDOW_MS;

    if (hasFreshData) {
      return;
    }

    await refetchUnreadCount().catch((err) => {
      logger.debug('header', 'Failed to refetch notifications', err);
    });
  }, [dataUpdatedAt, isFetching, refetchUnreadCount, showNotifications, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!showNotifications) {
        hasFocusedOnceRef.current = false;
        return;
      }

      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }

      void loadNotificationCount();
    }, [loadNotificationCount, showNotifications]),
  );

  useEffect(() => {
    if (!showNotifications || !userId) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadNotificationCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadNotificationCount, showNotifications, userId]);

  const notificationCount = showNotifications && userId ? unreadCount || 0 : 0;
  const badgeLabel = notificationCount > 99 ? '99+' : String(notificationCount);
  const openNotifications = useCallback(() => {
    if (userId) {
      prioritizeStartupWarmupStage('notifications');
    }

    openStackScreen(navigation, 'Notifications');
  }, [navigation, userId]);

  if (!showNotifications) {
    return <View style={[styles.safeArea, { paddingTop: topInset }]} />;
  }

  return (
    <View style={[styles.safeArea, { paddingTop: topInset }]}>
      <View style={[styles.header, { paddingHorizontal: appLayout.screenPadding }]}>
        <SoRitaLogo size="sm" showIcon={false} showTagline />
        <IconButton
          accessibilityLabel={tr.notifications.title}
          accessibilityHint={notificationCount > 0 ? tr.notifications.unreadHint(notificationCount) : undefined}
          onPress={openNotifications}
          style={styles.notificationButton}
        >
          <Bell color={colors.textMuted} size={iconSize.md} />
          {notificationCount > 0 ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.notificationBadge}
            >
              <AppText scaleLimit="chrome" style={styles.notificationBadgeText}>
                {badgeLabel}
              </AppText>
            </View>
          ) : null}
        </IconButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  header: {
    minHeight: layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationButton: {
    width: minTouchSize,
    height: minTouchSize,
  },
  notificationBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.xs,
    minWidth: 16,
    // The count sets the badge's size in both directions: a hard height turned
    // a scaled-up numeral into a clipped one.
    minHeight: 16,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  notificationBadgeText: {
    fontSize: typography.metadataText.fontSize,
    fontWeight: fontWeight.strong,
    color: colors.onPrimary,
    ...tabularNumbers,
  },
});
