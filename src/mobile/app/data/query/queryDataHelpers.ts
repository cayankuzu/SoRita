import type { InfiniteData } from '@tanstack/react-query';

/**
 * Type guard that checks if data is a TanStack Query InfiniteData structure.
 * Works for any paginated query result (lists, notifications, comments, etc.)
 */
export function isInfiniteData<TItem, TPageParam = unknown>(
  data: unknown,
): data is InfiniteData<TItem[], TPageParam> {
  return Boolean(
    data &&
      typeof data === 'object' &&
      Array.isArray((data as { pages?: unknown }).pages) &&
      Array.isArray((data as { pageParams?: unknown }).pageParams),
  );
}

/**
 * Flattens paginated InfiniteData into a single deduplicated array.
 * Handles both raw arrays and InfiniteData structures gracefully.
 */
export function flattenPages<TItem extends { id: string }>(
  data: InfiniteData<TItem[], unknown> | TItem[] | unknown,
): TItem[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (!isInfiniteData<TItem>(data)) {
    return [];
  }

  const seenIds = new Set<string>();
  return data.pages.flatMap((page) =>
    page.filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    }),
  );
}

/**
 * Maps over all items in paginated InfiniteData, preserving page structure.
 */
export function mapInfinitePages<TItem, TPageParam = unknown>(
  data: InfiniteData<TItem[], TPageParam> | undefined,
  mapper: (item: TItem) => TItem,
): InfiniteData<TItem[], TPageParam> | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => page.map(mapper)) };
}
