import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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

const BACKGROUND_TIP_DISMISSED_KEY = 'sorita.push-background-tip.dismissed';

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

export async function isBackgroundDeliveryTipDismissed() {
  return (await AsyncStorage.getItem(BACKGROUND_TIP_DISMISSED_KEY)) === '1';
}

export async function dismissBackgroundDeliveryTip() {
  await AsyncStorage.setItem(BACKGROUND_TIP_DISMISSED_KEY, '1');
}
