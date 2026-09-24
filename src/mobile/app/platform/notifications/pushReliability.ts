import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Linking, Platform } from 'react-native';

import { androidNotificationChannelId } from '@/mobile/app/platform/notifications/channels';

// Makers whose battery managers stop an app that was swiped away from the
// recent apps, and Android then drops every push until it is opened again
// (verified on a Xiaomi phone: the FCM broadcast returns CANCELLED). Their
// built-in allow lists cover Instagram and WhatsApp; other apps need the
// user to allow them once.
const RESTRICTIVE_MAKERS: Record<string, string> = {
  asus: 'ASUS',
  honor: 'HONOR',
  huawei: 'Huawei',
  infinix: 'Infinix',
  iqoo: 'vivo',
  meizu: 'Meizu',
  oneplus: 'OnePlus',
  oppo: 'OPPO',
  poco: 'Xiaomi',
  realme: 'realme',
  redmi: 'Xiaomi',
  tecno: 'TECNO',
  vivo: 'vivo',
  xiaomi: 'Xiaomi',
};

// v2: the tip now also covers pushes showing on screen, so it asks again.
const BACKGROUND_TIP_DISMISSED_KEY = 'sorita.push-background-tip.v2.dismissed';

/** The maker's name when this Android phone stops swiped-away apps, or null. */
export function getRestrictiveMakerName(): string | null {
  if (Platform.OS !== 'android') {
    return null;
  }

  const constants = Platform.constants as { Brand?: string; Manufacturer?: string };
  for (const value of [constants.Manufacturer, constants.Brand]) {
    const maker = RESTRICTIVE_MAKERS[value?.trim().toLowerCase() ?? ''];
    if (maker) {
      return maker;
    }
  }

  return null;
}

/**
 * Opens the settings of SoRita's push channel. MIUI and HyperOS keep "Kayan
 * bildirimler" (show on screen) and the lock screen choice per channel, and
 * create a new channel with both off, whatever the app asks: on a Xiaomi
 * phone pushes reached the shade and never the screen. Falls back to the
 * app's notification settings, then to its page.
 */
export async function openAppNotificationSettings() {
  const packageName = Application.applicationId;
  if (Platform.OS === 'android' && packageName) {
    const intents: Array<[string, Array<{ key: string; value: string }>]> = [
      [
        'android.settings.CHANNEL_NOTIFICATION_SETTINGS',
        [
          { key: 'android.provider.extra.APP_PACKAGE', value: packageName },
          { key: 'android.provider.extra.CHANNEL_ID', value: androidNotificationChannelId },
        ],
      ],
      [
        'android.settings.APP_NOTIFICATION_SETTINGS',
        [{ key: 'android.provider.extra.APP_PACKAGE', value: packageName }],
      ],
    ];

    for (const [action, extras] of intents) {
      try {
        await Linking.sendIntent(action, extras);
        return;
      } catch {
        // This build refuses the page; try the broader one.
      }
    }
  }

  await Linking.openSettings();
}

export async function isBackgroundDeliveryTipDismissed() {
  return (await AsyncStorage.getItem(BACKGROUND_TIP_DISMISSED_KEY)) === '1';
}

export async function dismissBackgroundDeliveryTip() {
  await AsyncStorage.setItem(BACKGROUND_TIP_DISMISSED_KEY, '1');
}
