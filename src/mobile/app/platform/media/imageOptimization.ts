import * as FileSystem from 'expo-file-system';
import { Image } from 'react-native';

/**
 * Image optimization utilities for production-ready media handling.
 * Ensures uploaded images are within size/dimension limits.
 */

const MAX_IMAGE_DIMENSION = 1280;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB after resize
const JPEG_QUALITY = 0.82;

export type ImageDimensions = {
  width: number;
  height: number;
};

/**
 * Get dimensions of a local image file.
 */
export function getImageDimensions(uri: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

/**
 * Calculate scaled dimensions maintaining aspect ratio.
 */
export function calculateScaledDimensions(
  width: number,
  height: number,
  maxDimension = MAX_IMAGE_DIMENSION,
): ImageDimensions {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * Check if file size exceeds max allowed bytes.
 */
export async function getFileSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? (info.size ?? 0) : 0;
}

/**
 * Generate a cache-friendly unique filename for uploads.
 */
export function generateUploadFilename(
  userId: string,
  extension: string,
  prefix = 'img',
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${userId}/${prefix}_${timestamp}_${random}.${extension}`;
}

export { MAX_IMAGE_DIMENSION, MAX_IMAGE_BYTES, JPEG_QUALITY };
