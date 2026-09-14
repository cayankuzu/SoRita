export function getLightboxPositionLabel(
  itemTypeLabel: string,
  zeroBasedIndex: number,
  totalCount: number,
) {
  const safeTotal = Math.max(1, Math.floor(totalCount));
  const safeIndex = Math.min(
    Math.max(0, Math.floor(zeroBasedIndex)),
    safeTotal - 1,
  );

  return `${itemTypeLabel} ${safeIndex + 1}/${safeTotal}`;
}
