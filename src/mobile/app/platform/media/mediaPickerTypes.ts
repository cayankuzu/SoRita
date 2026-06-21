export type PickedImageSource = 'camera' | 'library';

export type MediaPickerPromptOptions = {
  allowMultiple?: boolean;
  allowVideos?: boolean;
  availableSources?: PickedImageSource[];
  maxSelection?: number;
  remainingPhotos?: number;
  remainingVideos?: number;
  saveToGalleryDefault?: boolean;
};

export type MediaPickerPromptSelection = {
  saveToGallery: boolean;
  source: PickedImageSource;
};
