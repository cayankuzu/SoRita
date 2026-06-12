import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { getOrCreateDeviceId } from '@/mobile/app/platform/storage/deviceId';

type SignedEdgeHeadersParams = {
  accessToken: string;
  bodyText?: string;
};

function hashBody(bodyText: string) {
  return bytesToHex(sha256(utf8ToBytes(bodyText)));
}

function buildSigningMessage(params: {
  deviceId: string;
  nonce: string;
  payloadHash: string;
  timestamp: string;
}) {
  return [
    params.deviceId,
    params.timestamp,
    params.nonce,
    params.payloadHash,
  ].join(':');
}

export async function createSignedEdgeHeaders({
  accessToken,
  bodyText = '',
}: SignedEdgeHeadersParams) {
  const deviceId = await getOrCreateDeviceId();
  const timestamp =
    typeof Date.now === 'function' ? Date.now().toString() : new Date().getTime().toString();
  const nonce =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${deviceId}-${timestamp}`;
  const payloadHash = hashBody(bodyText);
  const signature = bytesToHex(
    hmac(
      sha256,
      utf8ToBytes(accessToken),
      utf8ToBytes(
        buildSigningMessage({
          deviceId,
          nonce,
          payloadHash,
          timestamp,
        }),
      ),
    ),
  );

  return {
    'x-device-id': deviceId,
    'x-nonce': nonce,
    'x-signature': signature,
    'x-timestamp': timestamp,
  };
}
