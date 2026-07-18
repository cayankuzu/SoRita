import type { Asset } from 'expo-media-library';

export type MediaLibrarySelectionFilter = 'all' | 'photo' | 'video';

export type MediaLibraryPickerAsset = Pick<
  Asset,
  'creationTime' | 'duration' | 'filename' | 'height' | 'id' | 'mediaType' | 'uri' | 'width'
> & {
  localUri?: string;
  previewUri?: string;
};

export type MediaLibrarySelectionOptions = {
  allowVideos?: boolean;
  disabledFilters?: MediaLibrarySelectionFilter[];
  initialFilter?: MediaLibrarySelectionFilter;
  maxSelection?: number;
  remainingPhotos?: number;
  remainingVideos?: number;
  visibleFilters?: MediaLibrarySelectionFilter[];
};
