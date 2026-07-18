export type PickedImageSource = 'camera' | 'library';
export type CameraCaptureMode = 'photo' | 'video';

export type MediaPickerPromptOptions = {
  allowMultiple?: boolean;
  allowVideos?: boolean;
  availableSources?: PickedImageSource[];
  cameraCaptureModes?: CameraCaptureMode[];
  cropAspect?: [number, number];
  cropShape?: 'oval' | 'rectangle';
  maxSelection?: number;
  remainingPhotos?: number;
  remainingVideos?: number;
  saveToGalleryDefault?: boolean;
};

export type MediaPickerPromptSelection = {
  cameraCaptureMode?: CameraCaptureMode;
  saveToGallery: boolean;
  source: PickedImageSource;
};
