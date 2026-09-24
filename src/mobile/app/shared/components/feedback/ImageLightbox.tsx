import React from 'react';

import type { PlaceMedia } from '@/mobile/app/contracts/placeMedia';
import { MediaLightbox } from '@/mobile/app/shared/components/feedback/MediaLightbox';

type ImageLightboxProps = {
  allowDownload?: boolean;
  initialIndex?: number;
  onClose: () => void;
  uri?: string | null;
  uris?: string[];
};

// Photos that are not a place's media (profile, cover, list cover) open in
// the same viewer as a place's: pinch and double-tap zoom, panning while
// zoomed, paging, saving. It used to be a second, 330-line viewer without
// zoom.
export function ImageLightbox({
  allowDownload = false,
  initialIndex = 0,
  onClose,
  uri = null,
  uris,
}: ImageLightboxProps) {
  const items = React.useMemo<PlaceMedia[]>(() => {
    const listed = (uris || []).filter(Boolean);
    const photos = listed.length > 0 ? listed : uri ? [uri] : [];
    return photos.map((url) => ({ type: 'photo', url }));
  }, [uri, uris]);

  return (
    <MediaLightbox
      allowDownload={allowDownload}
      initialIndex={initialIndex}
      items={items}
      onClose={onClose}
    />
  );
}
