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
  openSettings: () => void;
};

/** Says why pushes may not arrive and opens the setting that fixes it. */
export function NotificationDeliveryNotice({
  dismissTip,
  health,
  openSettings,
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
          actionLabel={copy.openSettings}
          description={copy.blockedDescription}
          onAction={openSettings}
          title={copy.blockedTitle}
          tone="warning"
        />
      ) : (
        <InlineNotice
          actionLabel={copy.openSettings}
          description={copy.backgroundTipDescription(health.maker)}
          onAction={openSettings}
          onSecondaryAction={dismissTip}
          secondaryActionLabel={copy.dismiss}
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
