import { useCallback, useState } from 'react';

import { pickSingleImageFromPrompt } from '@/mobile/app/platform/media/images';

type UseAuthRegistrationMediaParams = {
  onMediaChange: () => void;
};

export function useAuthRegistrationMedia({
  onMediaChange,
}: UseAuthRegistrationMediaParams) {
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>();
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>();

  const selectProfilePhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({
      cropAspect: [1, 1],
      cropShape: 'oval',
    });

    if (uri) {
      onMediaChange();
      setProfilePhoto(uri);
    }
  }, [onMediaChange]);

  const selectCoverPhoto = useCallback(async () => {
    const uri = await pickSingleImageFromPrompt({
      cropAspect: [21, 9],
      cropShape: 'rectangle',
    });

    if (uri) {
      onMediaChange();
      setCoverPhoto(uri);
    }
  }, [onMediaChange]);

  const clearProfilePhoto = useCallback(() => {
    onMediaChange();
    setProfilePhoto(undefined);
  }, [onMediaChange]);

  const clearCoverPhoto = useCallback(() => {
    onMediaChange();
    setCoverPhoto(undefined);
  }, [onMediaChange]);

  const resetRegistrationMedia = useCallback(() => {
    setProfilePhoto(undefined);
    setCoverPhoto(undefined);
  }, []);

  return {
    clearCoverPhoto,
    clearProfilePhoto,
    coverPhoto,
    profilePhoto,
    resetRegistrationMedia,
    selectCoverPhoto,
    selectProfilePhoto,
  };
}
