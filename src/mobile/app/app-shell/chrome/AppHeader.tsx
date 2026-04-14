import React, { useCallback, useEffect } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/mobile/app/app-shell/auth/AuthSessionProvider';
import {
  getCachedNotificationCount,
  refreshNotifications,
} from '@/mobile/app/data/repositories/notificationRepository';
import { useNotificationVersion } from '@/mobile/app/shared/hooks/useNotificationVersion';
import { SoRitaLogo } from '@/mobile/app/shared/components/brand/SoRitaLogo';
import { InstantPressable } from '@/mobile/app/shared/components/ui/InstantPressable';
import { colors, layout, radius } from '@/mobile/app/shared/theme/tokens';
import { openStackScreen } from '@/mobile/app/shared/utils/navigation';

export function AppHeader() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const showNotifications = route.name === 'Home';
  useNotificationVersion();

  const loadNotificationCount = useCallback(async () => {
    if (!user) {
      return;
    }

    await refreshNotifications(user.id).catch(() => undefined);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadNotificationCount();
    }, [loadNotificationCount]),
  );

  useEffect(() => {
    if (!showNotifications || !user) {
      return;
    }

    void loadNotificationCount();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadNotificationCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadNotificationCount, showNotifications, user]);

  const notificationCount = showNotifications && user ? getCachedNotificationCount(user.id) : 0;
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
