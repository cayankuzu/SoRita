import { describe, expect, it } from 'vitest';

import { shouldShowPlaceCardMiniMap } from '@/mobile/app/features/places/ui/components/place-card/placeCardMapVisibility';

describe('shouldShowPlaceCardMiniMap', () => {
  it('shows a default map only when media is absent and still supports toggling', () => {
    expect(shouldShowPlaceCardMiniMap({
      hasMedia: false,
      interactive: false,
      manuallyHidden: false,
    })).toBe(true);
    expect(shouldShowPlaceCardMiniMap({
      hasMedia: false,
      interactive: false,
      manuallyHidden: true,
    })).toBe(false);
    expect(shouldShowPlaceCardMiniMap({
      hasMedia: true,
      interactive: false,
      manuallyHidden: false,
    })).toBe(false);
    expect(shouldShowPlaceCardMiniMap({
      hasMedia: true,
      interactive: true,
      manuallyHidden: false,
    })).toBe(true);
  });
});
