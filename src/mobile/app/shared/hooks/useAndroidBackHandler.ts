import React from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export function useAndroidBackHandler(enabled: boolean, handler: () => boolean | void) {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== 'android' || !enabled) {
        return undefined;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        const handled = handlerRef.current();
        return handled === undefined ? true : handled;
      });

      return () => {
        subscription.remove();
      };
    }, [enabled]),
  );
}
