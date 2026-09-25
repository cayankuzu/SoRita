import { Platform, type FlatListProps } from 'react-native';

const TABLET_MIN_DIMENSION = 720;

export type AdaptiveFlatListParams = {
  containsNativeMaps?: boolean;
  itemCount: number;
  viewportHeight: number;
  viewportWidth: number;
  platformOS?: typeof Platform.OS;
};

export function isTabletLikeViewport(viewportWidth: number, viewportHeight: number) {
  return Math.min(viewportWidth, viewportHeight) >= TABLET_MIN_DIMENSION;
}

export function buildAdaptiveFlatListProps<ItemT>({
  containsNativeMaps = false,
  itemCount,
  viewportHeight,
  viewportWidth,
  platformOS = Platform.OS,
}: AdaptiveFlatListParams): Pick<
  FlatListProps<ItemT>,
  | 'contentInsetAdjustmentBehavior'
  | 'initialNumToRender'
  | 'keyboardDismissMode'
  | 'keyboardShouldPersistTaps'
  | 'maxToRenderPerBatch'
  | 'removeClippedSubviews'
  | 'updateCellsBatchingPeriod'
  | 'windowSize'
> {
  const isTabletLike = isTabletLikeViewport(viewportWidth, viewportHeight);
  const baseInitialItems = containsNativeMaps ? (isTabletLike ? 4 : 2) : isTabletLike ? 6 : 4;
  const safeItemCount = Math.max(itemCount, 1);
  const initialNumToRender = Math.min(safeItemCount, baseInitialItems);
  const maxToRenderPerBatch = containsNativeMaps ? (isTabletLike ? 5 : 3) : isTabletLike ? 8 : 6;
  const windowSize = containsNativeMaps ? (isTabletLike ? 6 : 4) : isTabletLike ? 8 : 6;
  const keyboardDismissMode: NonNullable<FlatListProps<ItemT>['keyboardDismissMode']> =
    platformOS === 'ios' ? 'interactive' : 'on-drag';

  return {
    contentInsetAdjustmentBehavior: 'automatic',
    initialNumToRender,
    keyboardDismissMode,
    keyboardShouldPersistTaps: 'handled',
    maxToRenderPerBatch,
    // Never on, and above all never switched as the item count changes: on
    // Android's new architecture, turning clipping off as a search emptied a
    // grid left its empty message undrawn, and switching it while rows came
    // and went made Fabric insert a view at a missing index and tear down the
    // app. Windowing already unmounts rows far off screen.
    removeClippedSubviews: false,
    updateCellsBatchingPeriod: containsNativeMaps ? 80 : isTabletLike ? 40 : 50,
    windowSize,
  };
}
