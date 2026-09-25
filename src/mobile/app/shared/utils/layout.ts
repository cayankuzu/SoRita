export type AppWindowClass = 'compact' | 'medium' | 'expanded';
export type AppHeightClass = 'short' | 'regular' | 'tall';
export type ResponsiveGridStrategy = 'discovery' | 'gallery' | 'mosaic';

// The hairline between cells of a mosaic grid, as Instagram draws it.
export const MOSAIC_GAP = 2;

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

function getWindowClass(usableWidth: number): AppWindowClass {
  if (usableWidth >= 840) {
    return 'expanded';
  }

  if (usableWidth >= 600) {
    return 'medium';
  }

  return 'compact';
}

function getHeightClass(usableHeight: number): AppHeightClass {
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

  // Three or more columns use the compact, media-first card presentation.
  if (usableWidth >= 540) {
    return 3;
  }

  // Rich cards need roughly 220dp of usable width per cell.
  return usableWidth >= 442 ? 2 : 1;
}

export function getResponsiveGalleryColumnCount(
  viewportWidth: number,
  viewportHeight: number,
  gap = 10,
) {
  const horizontalPadding = getResponsiveScreenPadding(viewportWidth, viewportHeight);
  const usableWidth = Math.max(0, viewportWidth - horizontalPadding * 2);
  const approximateThumbnailWidth = 112;

  return Math.max(
    3,
    Math.min(6, Math.floor((usableWidth + gap) / (approximateThumbnailWidth + gap))),
  );
}

/** Instagram's grid: three columns on a phone, more on a tablet or unfolded screen. */
export function getResponsiveMosaicColumnCount(viewportWidth: number) {
  if (viewportWidth >= 1040) {
    return 5;
  }

  return viewportWidth >= 600 ? 4 : 3;
}

export function getResponsiveGridLayout(
  viewportWidth: number,
  viewportHeight: number,
  {
    gap = 10,
    strategy = 'discovery',
  }: {
    gap?: number;
    strategy?: ResponsiveGridStrategy;
  } = {},
) {
  if (strategy === 'mosaic') {
    // Edge to edge, like a photo wall: no screen gutter, a hairline between cells.
    const columnCount = getResponsiveMosaicColumnCount(viewportWidth);

    return {
      columnCount,
      columnWidth: Math.floor((viewportWidth - MOSAIC_GAP * (columnCount - 1)) / columnCount),
      gap: MOSAIC_GAP,
      horizontalPadding: 0,
    };
  }

  const horizontalPadding = getResponsiveScreenPadding(viewportWidth, viewportHeight);
  const columnCount = strategy === 'gallery'
    ? getResponsiveGalleryColumnCount(viewportWidth, viewportHeight, gap)
    : getResponsiveDiscoveryColumnCount(viewportWidth, viewportHeight);
  const availableWidth = Math.max(
    0,
    viewportWidth - horizontalPadding * 2 - gap * (columnCount - 1),
  );

  return {
    columnCount,
    columnWidth: Math.floor(availableWidth / columnCount),
    gap,
    horizontalPadding,
  };
}

export function getResponsiveDiscoveryTileWidth(
  viewportWidth: number,
  viewportHeight: number,
  gap = 10,
) {
  return getResponsiveGridLayout(viewportWidth, viewportHeight, {
    gap,
    strategy: 'discovery',
  }).columnWidth;
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
