export function shouldUseCompactProfileTabs(width: number, fontScale: number) {
  return width <= 360 || fontScale >= 1.3;
}
