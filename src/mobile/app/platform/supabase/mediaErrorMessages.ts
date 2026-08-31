import {
  PLACE_MEDIA_MAX_FILE_SIZE_BYTES,
  PLACE_MEDIA_MAX_FILE_SIZE_MB,
} from '@/mobile/app/platform/media/placeMediaSize';
import { t } from '@/mobile/app/shared/i18n';

const PROFILE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export async function readMediaFunctionError(response: Response) {
  const retryAfterHeaderValue = response.headers.get('Retry-After');
  const retryAfterSecondsFromHeader =
    retryAfterHeaderValue && Number.isFinite(Number(retryAfterHeaderValue))
      ? Number(retryAfterHeaderValue)
      : null;
  const responseText = await response.text().catch(() => '');
  const trimmedResponseText = responseText.trim();

  const buildRateLimitMessage = (retryAfterSeconds?: number | null) => {
    const totalSeconds = Math.max(1, Math.ceil(retryAfterSeconds || 60));
    const retryAt = new Date(Date.now() + totalSeconds * 1000);
    const retryAtLabel = retryAt.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (totalSeconds < 60) {
      return `Medya istek sinirina ulasildi. Lutfen ${totalSeconds} saniye sonra, ${retryAtLabel} itibariyla tekrar deneyin.`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const durationLabel = seconds > 0 ? `${minutes} dk ${seconds} sn` : `${minutes} dk`;
    return `Medya istek sinirina ulasildi. Lutfen ${durationLabel} sonra, ${retryAtLabel} itibariyla tekrar deneyin.`;
  };

  if (trimmedResponseText) {
    try {
      const payload = JSON.parse(trimmedResponseText);

      if (payload && typeof payload === 'object') {
        if (response.status === 429 && retryAfterSecondsFromHeader) {
          return buildRateLimitMessage(retryAfterSecondsFromHeader);
        }

        if (
          response.status === 429
          && 'retryAfterSeconds' in payload
          && typeof payload.retryAfterSeconds === 'number'
          && payload.retryAfterSeconds > 0
        ) {
          return buildRateLimitMessage(payload.retryAfterSeconds);
        }

        if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
          return payload.error;
        }

        if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message;
        }
      }
    } catch {
      return trimmedResponseText;
    }
  }

  if (response.status === 429) {
    return buildRateLimitMessage(retryAfterSecondsFromHeader);
  }

  return response.statusText || `Media request failed (${response.status})`;
}

function readUploadResponseError(bodyText: string, fallbackMessage: string) {
  const trimmedBody = bodyText.trim();

  if (!trimmedBody) {
    return fallbackMessage;
  }

  try {
    const parsedBody = JSON.parse(trimmedBody);

    if (
      parsedBody
      && typeof parsedBody === 'object'
      && 'error' in parsedBody
      && typeof parsedBody.error === 'string'
      && parsedBody.error.trim()
    ) {
      return parsedBody.error;
    }

    if (
      parsedBody
      && typeof parsedBody === 'object'
      && 'message' in parsedBody
      && typeof parsedBody.message === 'string'
      && parsedBody.message.trim()
    ) {
      return parsedBody.message;
    }
  } catch {
    return trimmedBody;
  }

  return fallbackMessage;
}

export function buildUploadSizeLimitMessage(
  bucket: 'profile-media' | 'place-media',
  maxUploadBytes = bucket === 'place-media'
    ? PLACE_MEDIA_MAX_FILE_SIZE_BYTES
    : PROFILE_MEDIA_MAX_BYTES,
) {
  if (bucket === 'place-media' && maxUploadBytes === PLACE_MEDIA_MAX_FILE_SIZE_BYTES) {
    return t.placeEditor.mediaSizeLimitPopupDescription(PLACE_MEDIA_MAX_FILE_SIZE_MB);
  }

  return `Media upload failed (${Math.ceil(maxUploadBytes / (1024 * 1024))} MB max)`;
}

export function readStorageUploadError(params: {
  bodyText: string;
  bucket: 'profile-media' | 'place-media';
  fallbackMessage: string;
  maxUploadBytes: number;
  status: number;
}) {
  const normalizedBodyText = params.bodyText.trim().toLowerCase();

  if (
    params.status === 413
    || normalizedBodyText.includes('payload too large')
    || normalizedBodyText.includes('entity too large')
  ) {
    return buildUploadSizeLimitMessage(params.bucket, params.maxUploadBytes);
  }

  return readUploadResponseError(params.bodyText, params.fallbackMessage);
}
