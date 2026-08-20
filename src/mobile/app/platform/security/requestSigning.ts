import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { getOrCreateDeviceId } from '@/mobile/app/platform/storage/deviceId';
import { createUuid } from '@/shared/utils/id';

type SignedEdgeHeadersParams = {
  accessToken: string;
  bodyText?: string;
  functionName: string;
  legacy?: boolean;
  method?: string;
};

function hashBody(bodyText: string) {
  return bytesToHex(sha256(utf8ToBytes(bodyText)));
}

function buildSigningMessage(params: {
  deviceId: string;
  functionName: string;
  method: string;
  nonce: string;
  payloadHash: string;
  timestamp: string;
}) {
  return [
    params.method.toUpperCase(),
    params.functionName,
    params.deviceId,
    params.timestamp,
    params.nonce,
    params.payloadHash,
  ].join(':');
}

export async function createSignedEdgeHeaders({
  accessToken,
  bodyText = '',
  functionName,
  legacy = false,
  method = 'POST',
}: SignedEdgeHeadersParams) {
  let deviceId: string;
  try {
    deviceId = await getOrCreateDeviceId();
  } catch {
    deviceId = 'unknown-device';
  }
  const timestamp =
    typeof Date.now === 'function' ? Date.now().toString() : new Date().getTime().toString();
  // React Native does not guarantee a global `crypto.randomUUID`. A timestamp-only
  // fallback can collide when media and its thumbnail are uploaded in parallel,
  // causing the server to reject one request as a replay.
  const nonce = createUuid();
  const payloadHash = hashBody(bodyText);
  const signingMessage = legacy
    ? [deviceId, timestamp, nonce, payloadHash].join(':')
    : buildSigningMessage({
        deviceId,
        functionName,
        method,
        nonce,
        payloadHash,
        timestamp,
      });
  const signature = bytesToHex(
    hmac(
      sha256,
      utf8ToBytes(accessToken),
      utf8ToBytes(signingMessage),
    ),
  );

  return {
    'x-device-id': deviceId,
    'x-nonce': nonce,
    'x-signature': signature,
    'x-timestamp': timestamp,
  };
}
