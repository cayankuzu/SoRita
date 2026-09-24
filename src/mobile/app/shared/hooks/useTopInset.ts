import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The status bar's height, for a bar drawn at the very top of the screen.
 * The app is portrait-only, so the inset measured at launch holds; taking the
 * larger of the two also covers the first frame, which drew the brand bar
 * under the clock before the provider had measured.
 */
export function useTopInset() {
  const { top } = useSafeAreaInsets();
  return Math.max(top, initialWindowMetrics?.insets.top ?? 0);
}
