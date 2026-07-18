import type { PlaceEditorDraft } from '@/mobile/app/features/map/application/placeEditorDraft';

export type PlaceEditorSaveOptions = {
  onProgress?: (progress: number) => void;
  abortSignal?: AbortSignal;
};

export type PlaceEditorSaveSessionConfig = {
  abortSignal?: AbortSignal;
  onBannerOpen?: () => void;
  onBannerCancel?: () => void;
  onBannerRetry?: () => void;
};

export type PlaceEditorSaveStartHandler = (
  draft: PlaceEditorDraft,
) => PlaceEditorSaveSessionConfig | void;
