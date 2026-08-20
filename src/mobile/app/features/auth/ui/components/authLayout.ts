export function isCompactAuthLayout(params: {
  fontScale: number;
  height: number;
  isLandscape: boolean;
  width: number;
}) {
  return (
    params.width <= 360 ||
    params.height < 700 ||
    params.fontScale >= 1.3 ||
    params.isLandscape
  );
}
