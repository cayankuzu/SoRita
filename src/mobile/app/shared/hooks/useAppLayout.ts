import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  calculateAppLayout,
  type AppLayoutMetrics,
} from '@/mobile/app/shared/utils/layout';

type UseAppLayoutOptions = {
  maxContentWidth?: number;
};

export function useAppLayout(options: UseAppLayoutOptions = {}): AppLayoutMetrics & {
  fontScale: number;
  height: number;
  scale: number;
  width: number;
} {
  const { fontScale, height, scale, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(
    () => ({
      ...calculateAppLayout({
        bottomInset: insets.bottom,
        height,
        maxContentWidth: options.maxContentWidth,
        topInset: insets.top,
        width,
      }),
      fontScale,
      height,
      scale,
      width,
    }),
    [
      fontScale,
      height,
      insets.bottom,
      insets.top,
      options.maxContentWidth,
      scale,
      width,
    ],
  );
}
