import { Alert, Platform, ToastAndroid } from 'react-native';

import { logger } from '@/mobile/app/platform/feedback/logger';

type ToastKind = 'success' | 'error' | 'info';

export function showToast(message: string, kind: ToastKind = 'info') {
  if (kind === 'error') {
    logger.error('toast', message);
  } else if (kind === 'success') {
    logger.info('toast', message);
  } else {
    logger.debug('toast', message);
  }

  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  const title = kind === 'error' ? 'Hata' : kind === 'success' ? 'Tamam' : 'Bilgi';
  Alert.alert(title, message);
}
