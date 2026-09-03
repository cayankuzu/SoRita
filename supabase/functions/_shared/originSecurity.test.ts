import { describe, expect, it, vi } from 'vitest';

import {
  createTrustedEdgeOriginSignature,
  verifyTrustedEdgeOrigin,
} from './originSecurity';

const secret = 'origin-secret-that-is-at-least-thirty-two-bytes';
const functionName = 'media-assets';
const nonce = '018f47a2-2c50-4d87-8b51-d74965f68557';
const nowMs = 1_800_000_000_000;
const bodyText = '{"action":"create-read-url"}';

async function signedRequest(overrides: Record<string, string> = {}) {
  const timestamp = String(nowMs);
  const signed = await createTrustedEdgeOriginSignature({
    bodyText,
    functionName,
    nonce,
    secret,
    timestamp,
  });

  return new Request(`https://project.supabase.co/functions/v1/${functionName}`, {
    body: bodyText,
    headers: {
      'content-type': 'application/json',
      'x-sorita-edge-body-sha256': signed.bodyHash,
      'x-sorita-edge-nonce': nonce,
      'x-sorita-edge-signature': signed.signature,
      'x-sorita-edge-timestamp': timestamp,
      ...overrides,
    },
    method: 'POST',
  });
}

describe('trusted Cloudflare origin security', () => {
  it('fails closed when the rollout switch is absent instead of assuming direct mode', async () => {
    vi.stubGlobal('Deno', { env: { get: () => undefined } });
    const request = new Request('https://project.supabase.co/functions/v1/media-assets', {
      body: bodyText,
      method: 'POST',
    });

    await expect(verifyTrustedEdgeOrigin({
      adminClient: {},
      bodyText,
      functionName,
      nowMs,
      request,
    })).resolves.toMatchObject({ ok: false, status: 500 });
  });

  it('keeps direct compatibility only while enforcement is explicitly disabled', async () => {
    const request = new Request('https://project.supabase.co/functions/v1/media-assets', {
      body: bodyText,
      method: 'POST',
    });

    await expect(verifyTrustedEdgeOrigin({
      adminClient: {},
      bodyText,
      config: { required: false },
      functionName,
      nowMs,
      request,
    })).resolves.toEqual({ mode: 'direct', ok: true });

    await expect(verifyTrustedEdgeOrigin({
      adminClient: {},
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs,
      request,
    })).resolves.toMatchObject({ ok: false, status: 401 });
  });

  it('accepts the exact Worker signature and atomically claims its nonce', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const result = await verifyTrustedEdgeOrigin({
      adminClient: { rpc },
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs,
      request: await signedRequest(),
    });

    expect(result).toEqual({ mode: 'cloudflare', ok: true });
    expect(rpc).toHaveBeenCalledWith('claim_cloudflare_origin_nonce', {
      input_function_name: functionName,
      input_nonce: nonce,
    });
  });

  it('fails closed for tampering, stale signatures, replay, and nonce-store failure', async () => {
    const tampered = await verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn() },
      bodyText: `${bodyText} `,
      config: { required: true, secret },
      functionName,
      nowMs,
      request: await signedRequest(),
    });
    expect(tampered).toMatchObject({ ok: false, status: 401 });

    const stale = await verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn() },
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs: nowMs + 5 * 60 * 1000 + 1,
      request: await signedRequest(),
    });
    expect(stale).toMatchObject({ ok: false, status: 401 });

    const replay = await verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) },
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs,
      request: await signedRequest(),
    });
    expect(replay).toMatchObject({ ok: false, status: 409 });

    const unavailable = await verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'down' } }) },
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs,
      request: await signedRequest(),
    });
    expect(unavailable).toMatchObject({ ok: false, status: 500 });
  });

  it('refuses to verify a function that is not on the trusted edge list', async () => {
    const request = await signedRequest();

    // Enforcement on: an untrusted function name is a configuration fault.
    await expect(verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn() },
      bodyText,
      config: { required: true, secret },
      functionName: 'not-a-trusted-function',
      nowMs,
      request,
    })).resolves.toMatchObject({ ok: false, status: 500 });

    // Enforcement off: the same request is simply an invalid signature.
    await expect(verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn() },
      bodyText,
      config: { required: false, secret },
      functionName: 'not-a-trusted-function',
      nowMs,
      request,
    })).resolves.toMatchObject({ ok: false, status: 401 });
  });

  it('refuses to verify with a secret shorter than the minimum length', async () => {
    await expect(verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn() },
      bodyText,
      config: { required: true, secret: 'too-short' },
      functionName,
      nowMs,
      request: await signedRequest(),
    })).resolves.toMatchObject({ ok: false, status: 500 });
  });

  it('fails closed when any signed header is absent', async () => {
    for (const header of [
      'x-sorita-edge-timestamp',
      'x-sorita-edge-nonce',
      'x-sorita-edge-body-sha256',
      'x-sorita-edge-signature',
    ]) {
      const request = await signedRequest();
      request.headers.delete(header);

      await expect(verifyTrustedEdgeOrigin({
        adminClient: { rpc: vi.fn() },
        bodyText,
        config: { required: true, secret },
        functionName,
        nowMs,
        request,
      })).resolves.toMatchObject({ ok: false, status: 401 });
    }
  });

  it('fails closed when replay protection is unreachable or answers with a non-boolean', async () => {
    // No rpc surface at all: replay protection cannot run, so refuse.
    await expect(verifyTrustedEdgeOrigin({
      adminClient: {},
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs,
      request: await signedRequest(),
    })).resolves.toMatchObject({ ok: false, status: 500 });

    // An unexpected payload shape must never be read as a successful claim.
    await expect(verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn().mockResolvedValue({ data: 'yes', error: null }) },
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs,
      request: await signedRequest(),
    })).resolves.toMatchObject({ ok: false, status: 500 });
  });

  it('accepts a single-row array claim result from the nonce store', async () => {
    await expect(verifyTrustedEdgeOrigin({
      adminClient: { rpc: vi.fn().mockResolvedValue({ data: [true], error: null }) },
      bodyText,
      config: { required: true, secret },
      functionName,
      nowMs,
      request: await signedRequest(),
    })).resolves.toEqual({ mode: 'cloudflare', ok: true });
  });
});
