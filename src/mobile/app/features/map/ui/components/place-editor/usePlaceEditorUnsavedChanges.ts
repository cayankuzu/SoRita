import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { PlaceEditorDraft } from '@/mobile/app/contracts/placeEditorDraft';
import type { Place, PlaceList } from '@/mobile/app/data/contracts/entities';
import { buildPlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorPreview';
import { createInitialPlaceEditorFields } from '@/mobile/app/features/map/application/placeEditorStateUtils';

// Both sides go through the builder the editor's own draft comes from, which
// adds the photo list. A built draft against a raw one never matched, so every
// untouched editor asked whether to discard its changes on close.
function serializePlaceEditorDraft(draft: PlaceEditorDraft) {
  return JSON.stringify(buildPlaceEditorDraft({ ...draft, media: draft.media ?? [] }));
}

// Whether closing the editor would lose anything. Changes are measured
// against the place (or the tapped point) as it was, never against a
// reopened draft: a draft is itself unsaved work, and closing one without
// asking lost it.
export function usePlaceEditorUnsavedChanges({
  buildDraft,
  existingPlace,
  lat,
  lists,
  lng,
  placeAddress,
  placeName,
  visible,
}: {
  buildDraft: () => PlaceEditorDraft;
  existingPlace?: Place | null;
  lat: number;
  lists: PlaceList[];
  lng: number;
  placeAddress?: string;
  placeName?: string;
  visible: boolean;
}) {
  const baselineSourceRef = useRef<string | null>(null);
  const baselineSignatureRef = useRef<string | null>(null);
  const currentSignature = useMemo(() => serializePlaceEditorDraft(buildDraft()), [buildDraft]);
  const baselineSource = `base:${existingPlace?.id || 'new'}:${lat}:${lng}:${placeName || ''}:${placeAddress || ''}`;
  const buildBaselineSignature = useCallback(
    () =>
      serializePlaceEditorDraft(
        createInitialPlaceEditorFields({ existingPlace, lists, placeAddress, placeName }),
      ),
    [existingPlace, lists, placeAddress, placeName],
  );

  // The baseline is taken once per place, when the editor opens on it (or the
  // tapped point's name and address arrive), not on every keystroke.
  useEffect(() => {
    if (!visible) {
      baselineSourceRef.current = null;
      baselineSignatureRef.current = null;
      return;
    }

    if (baselineSourceRef.current === baselineSource) {
      return;
    }

    baselineSourceRef.current = baselineSource;
    baselineSignatureRef.current = buildBaselineSignature();
  }, [buildBaselineSignature, baselineSource, visible]);

  return (
    visible &&
    baselineSourceRef.current === baselineSource &&
    baselineSignatureRef.current != null &&
    currentSignature !== baselineSignatureRef.current
  );
}
