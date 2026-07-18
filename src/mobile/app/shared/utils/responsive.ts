import { Dimensions, PixelRatio, Platform, ScaledSize } from 'react-native';

/**
 * Responsive layout utilities for all mobile screen sizes.
 * Handles phones (small 320px to large 428px+) and tablets.
 */

const BASE_WIDTH = 375; // iPhone X/11/12 Pro as design base
const BASE_HEIGHT = 812;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function getWindowSize() {
  const { width, height } = Dimensions.get('window');
  return { height, width };
}

/**
 * Scale a value proportionally to the screen width.
 * Use for horizontal dimensions (width, padding-horizontal, margin-horizontal).
 */
export function scaleX(size: number): number {
  const { width } = getWindowSize();
  return Math.round(PixelRatio.roundToNearestPixel((width / BASE_WIDTH) * size));
}

/**
 * Scale a value proportionally to the screen height.
 * Use for vertical dimensions (height, padding-vertical, margin-vertical).
 */
export function scaleY(size: number): number {
  const { height } = getWindowSize();
  return Math.round(PixelRatio.roundToNearestPixel((height / BASE_HEIGHT) * size));
}

/**
 * Moderate scale: scales proportionally but with a dampening factor.
 * Best for font sizes and icon sizes — prevents them from getting too large on tablets.
 */
export function moderateScale(size: number, factor = 0.5): number {
  return Math.round(
    PixelRatio.roundToNearestPixel(size + (scaleX(size) - size) * factor),
  );
}

export type ScreenCategory = 'small' | 'medium' | 'large' | 'tablet';

/**
 * Detect screen size category for conditional layout decisions.
 */
export function getScreenCategory(width = SCREEN_WIDTH): ScreenCategory {
  if (width >= 768) return 'tablet';
  if (width >= 414) return 'large';
  if (width >= 375) return 'medium';
  return 'small';
}

/**
 * Check if device has a notch/dynamic island (safe area needed).
 */
export function hasNotch(): boolean {
  if (Platform.OS === 'ios') {
    return getWindowSize().height >= 812;
  }
  return false; // Android handled by SafeAreaView
}

/**
 * Get optimal grid column count for discovery/explore screens.
 */
export function getGridColumns(width = SCREEN_WIDTH): number {
  if (width >= 768) return 3;
  return 2;
}

/**
 * Calculate available content height (minus header + tabbar + safe areas).
 */
export function getContentHeight(
  windowHeight: number,
  headerHeight: number,
  tabBarHeight: number,
  topInset: number,
  bottomInset: number,
): number {
  return windowHeight - headerHeight - tabBarHeight - topInset - bottomInset;
}

/**
 * Listen for dimension changes (orientation, split-screen, etc.)
 */
export function subscribeToDimensionChanges(
  callback: (dims: { window: ScaledSize; screen: ScaledSize }) => void,
) {
  const subscription = Dimensions.addEventListener('change', callback);
  return () => subscription.remove();
}

export { SCREEN_WIDTH, SCREEN_HEIGHT };
