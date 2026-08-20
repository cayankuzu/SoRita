export function shouldShowPlaceCardMiniMap(params: {
  hasMedia: boolean;
  interactive: boolean;
  manuallyHidden: boolean;
}) {
  return params.interactive || (!params.hasMedia && !params.manuallyHidden);
}
