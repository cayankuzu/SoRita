import { tr } from '@/mobile/app/shared/i18n/tr';

// Android does not apply privacy/importance changes to an existing channel.
// Increment this ID whenever those immutable settings change.
export const androidNotificationChannelId = 'sorita-alerts-v5';

export const androidNotificationChannelName = tr.notifications.channelName;

export const androidNotificationChannelDescription = tr.notifications.channelDescription;
