import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { NotificationDeliveryHealth } from '@/mobile/app/features/notifications/application/useNotificationDeliveryHealth';
import { InlineNotice } from '@/mobile/app/shared/components/ui/InlineNotice';
import { useAppLayout } from '@/mobile/app/shared/hooks/useAppLayout';
import { tr } from '@/mobile/app/shared/i18n/tr';
import { spacing } from '@/mobile/app/shared/theme/tokens';

type NotificationDeliveryNoticeProps = {
  dismissTip: () => void;
  health: NotificationDeliveryHealth;
  openAppSettings: () => void;
  openNotificationSettings: () => void;
};

/** Says why pushes may not arrive and opens the setting that fixes it. */
export function NotificationDeliveryNotice({
  dismissTip,
  health,
  openAppSettings,
  openNotificationSettings,
}: NotificationDeliveryNoticeProps) {
  const { screenPadding } = useAppLayout();

  if (health.kind === 'ok') {
    return null;
  }

  const copy = tr.notifications.delivery;

  return (
    <View style={[styles.wrap, { paddingHorizontal: screenPadding }]}>
      {health.kind === 'blocked' ? (
        <InlineNotice
          actionLabel={copy.notificationSettings}
          description={copy.blockedDescription}
          onAction={openNotificationSettings}
          title={copy.blockedTitle}
          tone="warning"
        />
      ) : (
        <InlineNotice
          actionLabel={copy.notificationSettings}
          description={copy.backgroundTipDescription(health.maker)}
          extraActions={[
            { key: 'battery', label: copy.batterySettings, onPress: openAppSettings },
            { key: 'dismiss', label: copy.dismiss, onPress: dismissTip },
          ]}
          onAction={openNotificationSettings}
          title={copy.backgroundTipTitle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.md,
  },
});
