import type { PlaceList } from '@/mobile/app/data/contracts/entities';
import type { PlaceFeedCardItem } from '@/mobile/app/data/selectors/placeAggregation';
import { layout } from '@/mobile/app/shared/theme/tokens';

export type ProfilePagerTab = 'lists' | 'places' | 'gallery';

type ProfilePagerItem = PlaceList | PlaceFeedCardItem;

type EstimateProfilePagerHeightsParams = {
  columnCount: number;
  columnGap: number;
  hasNextPage: boolean;
  pageWidth: number;
  screenPadding: number;
  tabs: Record<ProfilePagerTab, ProfilePagerItem[]>;
};

const GRID_ITEM_GAP = 10;
const GRID_BOTTOM_PADDING = 20;
const EMPTY_STATE_HEIGHT = 280;
const FOOTER_HEIGHT = 54;
const PAGE_SAFETY_PADDING = 16;
const MEDIA_HEIGHT = layout.discoveryTileHeight;
const TEXT_LINE_HEIGHT = 17;
const TIMESTAMP_LINE_HEIGHT = 15;

function estimateTextLines(
  text: string | undefined,
  charsPerLine: number,
  maxLines: number,
) {
  if (!text) {
    return 0;
  }

  const normalizedText = text.trim().replace(/\r\n?/g, '\n');

  if (!normalizedText) {
    return 0;
  }

  const lineCount = normalizedText.split('\n').reduce((total, line) => {
    const normalizedLineLength = line.trim().length;

    return (
      total +
      Math.max(1, Math.ceil(normalizedLineLength / Math.max(1, charsPerLine)))
    );
  }, 0);

  return Math.min(maxLines, lineCount);
}

function getColumnWidth(
  pageWidth: number,
  screenPadding: number,
  columnGap: number,
  columnCount: number,
) {
  return Math.max(
    120,
    Math.floor(
      (pageWidth - screenPadding * 2 - columnGap * (columnCount - 1)) /
        Math.max(1, columnCount),
    ),
  );
}

function estimateListTileHeight(list: PlaceList, columnWidth: number) {
  const charsPerLine = Math.max(18, Math.floor((columnWidth - 24) / 6.4));
  const descriptionLines = estimateTextLines(list.description, charsPerLine, 2);
  const titleRowHeight = !list.coverImage && list.places.length > 0 ? 28 : 18;
  const descriptionHeight =
    descriptionLines > 0 ? 6 + descriptionLines * TEXT_LINE_HEIGHT : 0;
  const metaHeight = 20;
  const timestampHeight = 6 + TIMESTAMP_LINE_HEIGHT * 2;

  return (
    MEDIA_HEIGHT +
    22 +
    titleRowHeight +
    descriptionHeight +
    metaHeight +
    timestampHeight +
    8
  );
}

function estimatePlaceTileHeight(
  item: PlaceFeedCardItem,
  columnWidth: number,
  tab: Extract<ProfilePagerTab, 'places' | 'gallery'>,
) {
  const charsPerLine = Math.max(16, Math.floor((columnWidth - 24) / 6.2));
  const notesLines = estimateTextLines(item.place.notes, charsPerLine, 3);
  const notesHeight = notesLines > 0 ? 6 + notesLines * TEXT_LINE_HEIGHT : 0;
  const titleRowHeight = tab === 'gallery' ? 18 : 28;
  const listContextHeight = item.listName ? 60 : 0;
  const ratingHeight = item.place.rating ? 18 : 0;
  const timestampHeight = 21;

  return (
    MEDIA_HEIGHT +
    22 +
    titleRowHeight +
    notesHeight +
    listContextHeight +
    ratingHeight +
    timestampHeight +
    8
  );
}

function estimateMasonryColumnHeight<ItemT>(
  data: ItemT[],
  columnCount: number,
  estimateItemHeight: (item: ItemT) => number,
) {
  if (data.length === 0) {
    return 0;
  }

  const resolvedColumnCount = Math.max(1, columnCount);
  const columnHeights = Array.from({ length: resolvedColumnCount }, () => 0);

  data.forEach((item, index) => {
    const columnIndex = index % resolvedColumnCount;
    const nextItemHeight = estimateItemHeight(item);

    columnHeights[columnIndex] += columnHeights[columnIndex] > 0 ? GRID_ITEM_GAP : 0;
    columnHeights[columnIndex] += nextItemHeight;
  });

  return Math.max(...columnHeights);
}

function estimateTabHeight(
  tab: ProfilePagerTab,
  items: ProfilePagerItem[],
  columnCount: number,
  columnWidth: number,
  hasNextPage: boolean,
) {
  const footerHeight = hasNextPage ? FOOTER_HEIGHT : 0;

  if (items.length === 0) {
    return EMPTY_STATE_HEIGHT + footerHeight;
  }

  const gridHeight =
    tab === 'lists'
      ? estimateMasonryColumnHeight(
          items as PlaceList[],
          columnCount,
          (list) => estimateListTileHeight(list, columnWidth),
        )
      : estimateMasonryColumnHeight(
          items as PlaceFeedCardItem[],
          columnCount,
          (item) =>
            estimatePlaceTileHeight(
              item,
              columnWidth,
              tab as Extract<ProfilePagerTab, 'places' | 'gallery'>,
            ),
        );

  return gridHeight + GRID_BOTTOM_PADDING + footerHeight + PAGE_SAFETY_PADDING;
}

export function estimateProfilePagerHeights({
  columnCount,
  columnGap,
  hasNextPage,
  pageWidth,
  screenPadding,
  tabs,
}: EstimateProfilePagerHeightsParams) {
  const columnWidth = getColumnWidth(
    pageWidth,
    screenPadding,
    columnGap,
    columnCount,
  );

  return {
    gallery: estimateTabHeight(
      'gallery',
      tabs.gallery,
      columnCount,
      columnWidth,
      hasNextPage,
    ),
    lists: estimateTabHeight(
      'lists',
      tabs.lists,
      columnCount,
      columnWidth,
      hasNextPage,
    ),
    places: estimateTabHeight(
      'places',
      tabs.places,
      columnCount,
      columnWidth,
      hasNextPage,
    ),
  } satisfies Record<ProfilePagerTab, number>;
}
