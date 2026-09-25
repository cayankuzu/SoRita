// Calls the media edge function: session and token refresh, signed requests, and retries on expired signatures and rate limits.

import { env } from '@/mobile/app/platform/config/env';
import { getFunctionUrl } from '@/mobile/app/platform/api/edgeFunctions';
import { createSignedEdgeHeaders } from '@/mobile/app/platform/security/requestSigning';
import { supabase } from '@/mobile/app/platform/supabase/client';
import { readMediaFunctionError } from '@/mobile/app/platform/supabase/mediaErrorMessages';
import { refreshSupabaseSession } from '@/mobile/app/platform/supabase/sessionRefresh';
import { t } from '@/mobile/app/shared/i18n';
import { isAbortError, throwIfAborted, waitWithAbort } from '@/mobile/app/shared/utils/abort';

const AUTH_SESSION_WAIT_TIMEOUT_MS = 5_000;

const AUTH_SESSION_POLL_INTERVAL_MS = 150;

export async function getMediaRequestSession(signal?: AbortSignal, requireUser = false) {
  const waitDeadline = Date.now() + AUTH_SESSION_WAIT_TIMEOUT_MS;

  while (true) {
    throwIfAborted(signal);

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    if (session?.access_token && (!requireUser || session.user?.id)) {
      return {
        accessToken: session.access_token,
        userId: session.user?.id,
      };
    }

    const remainingWaitMs = waitDeadline - Date.now();

    if (remainingWaitMs <= 0) {
      throw new Error(t.settings.sessionMissing);
    }

    // Cached authenticated screens can render before the persisted Supabase
    // session has finished restoring. Wait briefly so private media does not
    // become a permanent fallback image during that startup window.
    await waitWithAbort(
      Math.min(AUTH_SESSION_POLL_INTERVAL_MS, remainingWaitMs),
      signal,
    );
  }
}

async function getAccessToken(signal?: AbortSignal) {
  return (await getMediaRequestSession(signal)).accessToken;
}

async function refreshAccessToken() {
  const {
    data: { session },
    error,
  } = await refreshSupabaseSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!session?.access_token) {
    throw new Error(t.system.sessionRefreshFailed);
  }

  return session.access_token;
}

async function performMediaFunctionRequest<TPayload extends Record<string, unknown>>(
  payload: TPayload,
  accessToken: string,
  signal?: AbortSignal,
) {
  const bodyText = JSON.stringify(payload);
  const signedHeaders = await createSignedEdgeHeaders({
    accessToken,
    bodyText,
    functionName: env.supabaseMediaAssetsFunctionName,
    method: 'POST',
  });

  return fetch(getFunctionUrl(env.supabaseMediaAssetsFunctionName), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: env.supabasePublishableKey,
      'Content-Type': 'application/json',
      ...signedHeaders,
    },
    body: bodyText,
    signal,
  });
}

async function isInvalidSignatureResponse(response: Response) {
  if (response.status !== 401) {
    return false;
  }

  const responseText = await response.clone().text().catch(() => '');

  try {
    const payload = JSON.parse(responseText) as { code?: unknown; error?: unknown };
    return payload.code === 'invalid_signature'
      || (typeof payload.error === 'string' && payload.error.includes('signature verification'));
  } catch {
    return responseText.includes('signature verification');
  }
}

export function isRetriableMediaStatus(status: number) {
  return status === 408 || status === 425 || status === 500 || status === 502 || status === 503 || status === 504;
}

const MAX_MEDIA_REQUEST_ATTEMPTS = 3;

const MAX_AUTO_RATE_LIMIT_RETRY_AFTER_SECONDS = 12;

export const MEDIA_RETRY_BASE_DELAY_MS = 500;

type MediaRequestSession = {
  accessToken: string;
  userId?: string;
};

async function readRetryAfterSeconds(response: Response) {
  const retryAfterHeaderValue = response.headers.get('Retry-After');
  const retryAfterSecondsFromHeader =
    retryAfterHeaderValue && Number.isFinite(Number(retryAfterHeaderValue))
      ? Number(retryAfterHeaderValue)
      : null;

  if (retryAfterSecondsFromHeader && retryAfterSecondsFromHeader > 0) {
    return retryAfterSecondsFromHeader;
  }

  try {
    const responseText = await response.clone().text();
    const trimmedResponseText = responseText.trim();

    if (!trimmedResponseText) {
      return null;
    }

    const payload = JSON.parse(trimmedResponseText);

    if (
      payload &&
      typeof payload === 'object' &&
      'retryAfterSeconds' in payload &&
      typeof payload.retryAfterSeconds === 'number' &&
      payload.retryAfterSeconds > 0
    ) {
      return payload.retryAfterSeconds;
    }
  } catch {
    return null;
  }

  return null;
}

export async function callMediaFunction<TPayload extends Record<string, unknown>, TResult>(
  payload: TPayload,
  signal?: AbortSignal,
  requestSession?: MediaRequestSession,
): Promise<TResult> {
  let accessToken = requestSession?.accessToken ?? await getAccessToken(signal);
  let refreshedSessionAfterUnauthorized = false;

  for (let attempt = 0; attempt < MAX_MEDIA_REQUEST_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal);
    let response: Response;

    try {
      response = await performMediaFunctionRequest(
        payload,
        accessToken,
        signal,
      );
    } catch (error) {
      if (
        isAbortError(error) ||
        signal?.aborted ||
        attempt >= MAX_MEDIA_REQUEST_ATTEMPTS - 1
      ) {
        throw error;
      }

      await waitWithAbort(MEDIA_RETRY_BASE_DELAY_MS * (attempt + 1), signal);
      continue;
    }

    if (response.ok) {
      return (await response.json()) as TResult;
    }

    if (await isInvalidSignatureResponse(response)) {
      throw new Error(await readMediaFunctionError(response));
    }

    if (response.status === 401 && !refreshedSessionAfterUnauthorized) {
      accessToken = await refreshAccessToken();
      if (requestSession) {
        requestSession.accessToken = accessToken;
      }
      refreshedSessionAfterUnauthorized = true;
      continue;
    }

    if (response.status === 429 && attempt < MAX_MEDIA_REQUEST_ATTEMPTS - 1) {
      const retryAfterSeconds = await readRetryAfterSeconds(response);

      if (
        retryAfterSeconds &&
        retryAfterSeconds > 0 &&
        retryAfterSeconds <= MAX_AUTO_RATE_LIMIT_RETRY_AFTER_SECONDS
      ) {
        await waitWithAbort(retryAfterSeconds * 1000, signal);
        continue;
      }
    }

    if (isRetriableMediaStatus(response.status) && attempt < MAX_MEDIA_REQUEST_ATTEMPTS - 1) {
      await waitWithAbort(MEDIA_RETRY_BASE_DELAY_MS * (attempt + 1), signal);
      continue;
    }

    throw new Error(await readMediaFunctionError(response));
  }

  throw new Error('Media request failed');
}
