/**
 * The basemap a place preview draws under its pin. Google's default paints
 * every nearby business and bus stop with a name and an icon, so a card about
 * one café showed three other venues' names louder than its own pin. Roads,
 * parks, water and district names stay; businesses and transit icons go.
 *
 * One rule list feeds both renderers: the Static Maps URL a resting preview
 * loads, and the native map an activated preview becomes.
 */
type BasemapRule = {
  featureType: string;
  elementType?: string;
  stylers: { visibility: 'off' }[];
};

export const QUIET_BASEMAP_RULES: BasemapRule[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

export function quietBasemapStaticParams() {
  return QUIET_BASEMAP_RULES.map((rule) =>
    [
      `feature:${rule.featureType}`,
      ...(rule.elementType ? [`element:${rule.elementType}`] : []),
      ...rule.stylers.map((styler) => `visibility:${styler.visibility}`),
    ].join('|'),
  );
}
