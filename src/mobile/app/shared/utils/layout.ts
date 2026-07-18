export type AppWindowClass = 'compact' | 'medium' | 'expanded';
export type AppHeightClass = 'short' | 'regular' | 'tall';

export type AppLayoutMetrics = {
  bottomObstruction: number;
  columnCount: number;
  columnGap: number;
  contentWidth: number;
  heightClass: AppHeightClass;
  isLandscape: boolean;
  isSplitLike: boolean;
  screenPadding: number;
  usableHeight: number;
  usableWidth: number;
  windowClass: AppWindowClass;
};

export function getWindowClass(usableWidth: number): AppWindowClass {
  if (usableWidth >= 840) {
    return 'expanded';
  }

  if (usableWidth >= 600) {
    return 'medium';
  }

  return 'compact';
}

export function getHeightClass(usableHeight: number): AppHeightClass {
  if (usableHeight < 560) {
    return 'short';
  }

  if (usableHeight >= 840) {
    return 'tall';
  }

  return 'regular';
}

export function getResponsiveScreenPadding(viewportWidth: number, viewportHeight: number) {
  const minDimension = Math.min(viewportWidth, viewportHeight);

  if (minDimension >= 840) {
    return 32;
  }

  if (minDimension >= 600) {
    return 24;
  }

  return 16;
}

export function getResponsiveDiscoveryColumnCount(
  viewportWidth: number,
  viewportHeight: number,
) {
  const horizontalPadding = getResponsiveScreenPadding(viewportWidth, viewportHeight);
  const usableWidth = Math.max(0, viewportWidth - horizontalPadding * 2);

  if (usableWidth >= 1040) {
    return 4;
  }

  if (usableWidth >= 600) {
    return 3;
  }

  return usableWidth < 320 ? 1 : 2;
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

  return Math.max(120, Math.floor(availableWidth / columnCount));
}

export function calculateAppLayout(params: {
  bottomInset?: number;
  height: number;
  maxContentWidth?: number;
  topInset?: number;
  width: number;
}): AppLayoutMetrics {
  const topInset = params.topInset || 0;
  const bottomInset = params.bottomInset || 0;
  const usableWidth = Math.max(0, params.width);
  const usableHeight = Math.max(0, params.height - topInset - bottomInset);
  const screenPadding = getResponsiveScreenPadding(params.width, params.height);
  const windowClass = getWindowClass(Math.max(0, usableWidth - screenPadding * 2));
  const heightClass = getHeightClass(usableHeight);
  const columnGap = windowClass === 'compact' ? 10 : 12;
  const columnCount = getResponsiveDiscoveryColumnCount(params.width, params.height);
  const maxContentWidth = params.maxContentWidth || Number.POSITIVE_INFINITY;
  const contentWidth = Math.min(
    Math.max(0, usableWidth - screenPadding * 2),
    maxContentWidth,
  );

  return {
    bottomObstruction: bottomInset,
    columnCount,
    columnGap,
    contentWidth,
    heightClass,
    isLandscape: params.width > params.height,
    isSplitLike: usableWidth < 360 || (params.width > params.height && usableHeight < 520),
    screenPadding,
    usableHeight,
    usableWidth,
    windowClass,
  };
}
