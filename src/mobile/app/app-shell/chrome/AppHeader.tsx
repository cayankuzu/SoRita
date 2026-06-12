import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import { openStackScreen, useAppNavigation } from '@/mobile/app/app-shell/navigation/navigation';
import { useNotificationsQuery } from '@/mobile/app/data/hooks/useNotificationsQuery';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, layout, radius } from '@/mobile/app/shared/theme/tokens';

export function AppHeader() {
  const navigation = useAppNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const showNotifications = route.name === 'Home';
  const notificationsQuery = useNotificationsQuery(user?.id, { enabled: showNotifications });
  const hasFocusedOnceRef = useRef(false);

  const loadNotificationCount = useCallback(async () => {
    if (!showNotifications || !user || notificationsQuery.isFetching) {
      return;
    }

    const hasFreshData =
      notificationsQuery.dataUpdatedAt > 0 &&
      Date.now() - notificationsQuery.dataUpdatedAt < 1000 * 20;

    if (hasFreshData) {
      return;
    }

    await notificationsQuery.refetch().catch(() => undefined);
  }, [notificationsQuery, showNotifications, user]);

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
    if (!showNotifications || !user) {
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
  }, [loadNotificationCount, showNotifications, user]);

  const notificationCount = showNotifications && user
    ? (notificationsQuery.data || []).filter((item) => !item.read).length
    : 0;
  const badgeLabel = notificationCount > 99 ? '99+' : String(notificationCount);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <SoRitaLogo size="lg" />
        {showNotifications ? (
          <InstantPressable
            onPress={() => openStackScreen(navigation, 'Notifications')}
            style={({ pressed }) => [styles.notificationButton, pressed ? styles.pressed : null]}
          >
            <Bell color={colors.textSoft} size={22} />
            {notificationCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </InstantPressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    </SafeAreaView>
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
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.onPrimary,
  },
  headerSpacer: {
    width: 46,
    height: 46,
  },
});
