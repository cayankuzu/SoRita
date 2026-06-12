import { spacing } from '@/mobile/app/shared/theme/tokens';

export function getResponsiveScreenPadding(viewportWidth: number, viewportHeight: number) {
  const minViewportDimension = Math.min(viewportWidth, viewportHeight);

  if (minViewportDimension >= 1024) {
    return 32;
  }

  if (minViewportDimension >= 720) {
    return 24;
  }

  return spacing.screen;
}

export function getResponsiveDiscoveryColumnCount(
  viewportWidth: number,
  viewportHeight: number,
) {
  const minViewportDimension = Math.min(viewportWidth, viewportHeight);

  if (minViewportDimension >= 1200) {
    return 4;
  }

  if (minViewportDimension >= 720) {
    return 3;
  }

  return 2;
}

export function getResponsiveDiscoveryTileWidth(
  viewportWidth: number,
  viewportHeight: number,
  gap = 10,
) {
  const horizontalPadding = getResponsiveScreenPadding(viewportWidth, viewportHeight);
  const columnCount = getResponsiveDiscoveryColumnCount(viewportWidth, viewportHeight);
  const availableWidth =
    viewportWidth - horizontalPadding * 2 - gap * (columnCount - 1);

  return Math.max(148, Math.floor(availableWidth / columnCount));
}
