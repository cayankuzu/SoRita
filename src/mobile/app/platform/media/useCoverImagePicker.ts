import { useCallback, useRef, useState } from 'react';

import { pickSingleImageFromPrompt } from '@/mobile/app/platform/media/images';
import { waitForMediaPickerTransition } from '@/mobile/app/platform/media/mediaPickerTransition';

// Picks a list cover: one 16:9 photo from the camera or the gallery. A second
// tap while the picker is opening is ignored (a ref, so two quick taps in one
// frame cannot both get through). The list editor and the place editor's
// "new list" form each wrote this themselves.
export function useCoverImagePicker(onPicked: (uri: string) => void, disabled = false) {
  const [isPicking, setIsPicking] = useState(false);
  const pickingRef = useRef(false);

  const pickCover = useCallback(async () => {
    if (disabled || pickingRef.current) {
      return;
    }

    pickingRef.current = true;
    setIsPicking(true);

    try {
      await waitForMediaPickerTransition();

      const uri = await pickSingleImageFromPrompt({
        cropAspect: [16, 9],
        cropShape: 'rectangle',
      });

      if (uri) {
        onPicked(uri);
      }
    } finally {
      await waitForMediaPickerTransition();
      pickingRef.current = false;
      setIsPicking(false);
    }
  }, [disabled, onPicked]);

  return { isPicking, pickCover };
}
