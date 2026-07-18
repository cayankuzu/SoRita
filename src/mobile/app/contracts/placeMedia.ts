export type PlaceMediaType = 'photo' | 'video';

export interface PlaceMedia {
  id?: string;
  url: string;
  type: PlaceMediaType;
  mimeType?: string;
  durationMs?: number;
  thumbnailUrl?: string;
  thumbnailTimeMs?: number;
  width?: number;
  height?: number;
  fileName?: string;
}

export type PlaceMediaContainer = {
  media?: PlaceMedia[] | null;
  photos?: string[] | null;
};

function getExtension(value?: string | null) {
  if (!value) {
    return '';
  }

  const cleanValue = value.split('?')[0] || value;
  return cleanValue.split('.').pop()?.toLowerCase() || '';
}

export function inferPlaceMediaType(input: {
  mimeType?: string | null;
  url?: string | null;
}): PlaceMediaType {
  if (input.mimeType?.startsWith('video/')) {
    return 'video';
  }

  if (input.mimeType?.startsWith('image/')) {
    return 'photo';
  }

  const extension = getExtension(input.url);
  return ['mp4', 'mov', 'm4v', 'webm', '3gp'].includes(extension) ? 'video' : 'photo';
}
