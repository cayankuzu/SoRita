import { useEffect, useRef } from 'react';
import { useNavigation, type ParamListBase } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

/**
 * Runs `onReselect` when the tab this screen belongs to is tapped again while
 * it is showing, the way a second tap on Instagram's profile tab closes the
 * post feed. The tap's default, scrolling the tab's list to the top, is
 * cancelled so the list underneath stays where it was left.
 */
export function useTabReselect(enabled: boolean, onReselect: () => void) {
  const navigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const onReselectRef = useRef(onReselect);
  onReselectRef.current = onReselect;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return navigation.addListener('tabPress', (event) => {
      if (!navigation.isFocused()) {
        return;
      }

      event.preventDefault();
      onReselectRef.current();
    });
  }, [enabled, navigation]);
}
