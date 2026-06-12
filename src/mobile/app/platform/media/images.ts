import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import {
  getLocalMediaFileExtension,
  persistLocalUriToFile,
} from '@/mobile/app/platform/media/localFiles';

const PICKED_IMAGE_DIR = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ''}picked-media/`;

function buildPickedImagePath(uri: string) {
  const extension = getLocalMediaFileExtension(uri);
  const uniqueKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PICKED_IMAGE_DIR}${uniqueKey}.${extension}`;
}

export async function pickSingleImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    base64: true,
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    legacy: true,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    selectionLimit: 1,
    shouldDownloadFromNetwork: true,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const selectedAsset = result.assets[0];
  const assetUri = selectedAsset.uri;

  return (
    (await persistLocalUriToFile({
      base64Value: selectedAsset.base64,
      uri: assetUri,
      targetPath: buildPickedImagePath(assetUri),
    })) || null
  );
}
