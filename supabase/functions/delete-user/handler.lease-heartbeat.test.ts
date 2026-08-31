import { describe, expect, it, vi } from 'vitest';

import { createRequestSignature, sha256Hex } from '../_shared/requestSecurity';
import { createDeleteUserHandler } from './handler';

type ErrorResult = {
  message: string;
  status?: number;
};

type RpcReply = {
  data?: unknown;
  error?: ErrorResult | null;
};

type DeletionClaim = {
  claim_status: 'claimed' | 'completed' | 'in_progress';
  last_completed_step: 'requested' | 'storage_deleted' | 'notifications_deleted' | 'auth_delete_started' | 'completed';
  retry_after_seconds: number;
};

type HarnessOptions = {
  claimData?: unknown;
  claimError?: ErrorResult | null;
  claimsResult?: {
    data?: { claims?: { sub?: string } | null } | null;
    error?: ErrorResult | null;
  };
  completedJobReply?: RpcReply;
  deleteUserError?: ErrorResult | null;
  renewalReplies?: RpcReply[];
  userResult?: {
    data?: { user?: { id?: string } | null } | null;
    error?: ErrorResult | null;
  };
};

const defaultClaim: DeletionClaim = {
  claim_status: 'claimed',
  last_completed_step: 'requested',
  retry_after_seconds: 0,
};

function createHarness(options: HarnessOptions = {}) {
  const events: string[] = [];
  const recordedSteps: Array<{ error: unknown; step: unknown }> = [];
  const renewalReplies = options.renewalReplies ?? [{ data: true, error: null }];
  let renewalReplyIndex = 0;

  const getClaimsMock = vi.fn().mockResolvedValue(options.claimsResult ?? {
    data: { claims: { sub: 'user-1' } },
    error: null,
  });
  const getUserMock = vi.fn().mockResolvedValue(options.userResult ?? {
    data: { user: { id: 'user-1' } },
    error: null,
  });
  const deleteUserMock = vi.fn().mockResolvedValue({ error: options.deleteUserError ?? null });
  const nonceDeleteLtMock = vi.fn().mockResolvedValue({ error: null });
  const nonceInsertMock = vi.fn().mockResolvedValue({ error: null });
  const notificationsEqMock = vi.fn().mockResolvedValue({ error: null });
  const listMock = vi.fn(async (bucket: string, path: string) => {
    events.push(`list:${bucket}:${path}`);
    return {
      data: [{ id: `${bucket}-file`, name: 'cover.jpg' }],
      error: null,
    };
  });
  const removeMock = vi.fn(async (bucket: string, paths: string[]) => {
    events.push(`remove:${bucket}:${paths.join(',')}`);
    return { error: null };
  });
  const storageFromMock = vi.fn((bucket: string) => ({
    list: (path: string, _options: { limit: number; offset: number }) => listMock(bucket, path),
    remove: (paths: string[]) => removeMock(bucket, paths),
  }));
  const rpcMock = vi.fn((functionName: string, args?: Record<string, unknown>) => {
    if (functionName === 'enforce_edge_rate_limit') {
      return Promise.resolve({
        data: { allowed: true, remaining: 1, retry_after_seconds: 0 },
        error: null,
      });
    }

    if (functionName === 'claim_account_deletion_job') {
      return Promise.resolve({
        data: options.claimData === undefined ? defaultClaim : options.claimData,
        error: options.claimError ?? null,
      });
    }

    if (functionName === 'renew_account_deletion_job_lease') {
      events.push('renew');
      const reply = renewalReplies[Math.min(renewalReplyIndex, renewalReplies.length - 1)] ?? {
        data: true,
        error: null,
      };
      renewalReplyIndex += 1;
      return Promise.resolve(reply);
    }

    if (functionName === 'record_account_deletion_step') {
      recordedSteps.push({ error: args?.p_error, step: args?.p_step });
      events.push(`record:${String(args?.p_step)}`);
      return Promise.resolve({ data: null, error: null });
    }

    if (functionName === 'is_account_deletion_job_completed') {
      return Promise.resolve(options.completedJobReply ?? { data: false, error: null });
    }

    return Promise.resolve({ data: null, error: { message: `Unexpected RPC: ${functionName}` } });
  });

  const handler = createDeleteUserHandler({
    config: {
      allowedOrigins: ['http://localhost:5173'],
      supabasePublishableKey: 'anon-key',
      supabaseServiceRoleKey: 'service-role',
      supabaseUrl: 'https://example.supabase.co',
    },
    createAdminClient: () => ({
      rpc: rpcMock,
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
      from: (table: string) => {
        if (table === 'request_nonces') {
          return {
            delete: () => ({ lt: nonceDeleteLtMock }),
            insert: nonceInsertMock,
          };
        }

        return {
          delete: () => ({ eq: notificationsEqMock }),
        };
      },
      storage: {
        from: storageFromMock,
      },
    }),
    createAuthClient: () => ({
      auth: {
        getClaims: getClaimsMock,
        getUser: getUserMock,
      },
    }),
  });

  return {
    deleteUserMock,
    events,
    getClaimsMock,
    getUserMock,
    handler,
    listMock,
    notificationsEqMock,
    recordedSteps,
    removeMock,
    rpcMock,
  };
}

let requestCounter = 0;

async function createSignedDeleteRequest() {
  requestCounter += 1;
  const body = '{}';
  const deviceId = `delete-heartbeat-device-${requestCounter}`;
  const nonce = `delete-heartbeat-nonce-${requestCounter}`;
  const timestamp = Date.now().toString();
  const payloadHash = await sha256Hex(body);
  const signature = await createRequestSignature('token-1', {
    deviceId,
    functionName: 'delete-user',
    method: 'POST',
    nonce,
    payloadHash,
    timestamp,
  });

  return new Request('https://example.supabase.co/functions/v1/delete-user', {
    body,
    headers: {
      Authorization: 'Bearer token-1',
      'x-device-id': deviceId,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-timestamp': timestamp,
    },
    method: 'POST',
  });
}

describe('delete-user lease heartbeat coverage', () => {
  it('renews before each storage listing and removal, including an array RPC reply', async () => {
    const harness = createHarness({
      claimData: [defaultClaim],
      renewalReplies: [{ data: [true], error: null }, { data: true, error: null }],
    });

    const response = await harness.handler(await createSignedDeleteRequest());

    expect(response.status).toBe(200);
    expect(harness.listMock).toHaveBeenCalledTimes(3);
    expect(harness.removeMock).toHaveBeenCalledTimes(3);
    expect(harness.deleteUserMock).toHaveBeenCalledWith('user-1', false);
    expect(harness.recordedSteps.map(({ step }) => step)).toEqual([
      'storage_deleted',
      'notifications_deleted',
      'auth_delete_started',
      'completed',
    ]);

    for (const [index, event] of harness.events.entries()) {
      if (event.startsWith('list:') || event.startsWith('remove:')) {
        expect(harness.events[index - 1]).toBe('renew');
      }
    }

    const renewalCalls = harness.rpcMock.mock.calls.filter(([name]) => name === 'renew_account_deletion_job_lease');
    expect(renewalCalls.length).toBeGreaterThanOrEqual(10);
    expect(renewalCalls[0]?.[1]).toMatchObject({
      p_lease_seconds: 300,
      p_user_id: 'user-1',
    });
  });

  it('stops destructive work and records a failed step when a renewal has no valid lease result', async () => {
    const harness = createHarness({
      renewalReplies: [{ data: null, error: null }],
    });

    const response = await harness.handler(await createSignedDeleteRequest());

    expect(response.status).toBe(500);
    expect(harness.listMock).not.toHaveBeenCalled();
    expect(harness.removeMock).not.toHaveBeenCalled();
    expect(harness.notificationsEqMock).not.toHaveBeenCalled();
    expect(harness.deleteUserMock).not.toHaveBeenCalled();
    expect(harness.recordedSteps).toEqual([{
      error: 'Account deletion lease could not be renewed.',
      step: 'failed',
    }]);
  });

  it('uses the renewal RPC error in the failed ledger entry and prevents later effects', async () => {
    const harness = createHarness({
      renewalReplies: [{ data: true, error: { message: 'lease service unavailable' } }],
    });

    const response = await harness.handler(await createSignedDeleteRequest());

    expect(response.status).toBe(500);
    expect(harness.listMock).not.toHaveBeenCalled();
    expect(harness.deleteUserMock).not.toHaveBeenCalled();
    expect(harness.recordedSteps).toEqual([{
      error: 'lease service unavailable',
      step: 'failed',
    }]);
  });

  it('fails closed for an invalid envelope, claims, identity, and deletion claim', async () => {
    const envelopeHarness = createHarness();
    const envelopeResponse = await envelopeHarness.handler(
      new Request('https://example.supabase.co/functions/v1/delete-user', {
        body: '{}',
        headers: { Authorization: 'Bearer token-1' },
        method: 'POST',
      }),
    );
    expect(envelopeResponse.status).toBe(401);

    const invalidClaimsHarness = createHarness({
      claimsResult: { data: null, error: { message: 'claims lookup failed' } },
    });
    const invalidClaimsResponse = await invalidClaimsHarness.handler(await createSignedDeleteRequest());
    expect(invalidClaimsResponse.status).toBe(401);
    expect(invalidClaimsHarness.getUserMock).not.toHaveBeenCalled();

    const mismatchedIdentityHarness = createHarness({
      userResult: { data: { user: { id: 'another-user' } }, error: null },
    });
    const mismatchedIdentityResponse = await mismatchedIdentityHarness.handler(await createSignedDeleteRequest());
    expect(mismatchedIdentityResponse.status).toBe(401);

    const claimRpcFailureHarness = createHarness({ claimError: { message: 'claim rpc failed' } });
    const claimRpcFailureResponse = await claimRpcFailureHarness.handler(await createSignedDeleteRequest());
    expect(claimRpcFailureResponse.status).toBe(500);

    for (const claimData of [null, { claim_status: 'invalid' }]) {
      const invalidClaimHarness = createHarness({ claimData });
      const invalidClaimResponse = await invalidClaimHarness.handler(await createSignedDeleteRequest());
      expect(invalidClaimResponse.status).toBe(500);
      expect(invalidClaimHarness.listMock).not.toHaveBeenCalled();
    }
  });

  it('resumes from auth deletion and accepts a missing user message as idempotent completion', async () => {
    const harness = createHarness({
      claimData: {
        claim_status: 'claimed',
        last_completed_step: 'auth_delete_started',
        retry_after_seconds: 0,
      },
      deleteUserError: { message: 'User does not exist' },
    });

    const response = await harness.handler(await createSignedDeleteRequest());

    expect(response.status).toBe(200);
    expect(harness.listMock).not.toHaveBeenCalled();
    expect(harness.notificationsEqMock).not.toHaveBeenCalled();
    expect(harness.deleteUserMock).toHaveBeenCalledWith('user-1', false);
    expect(harness.recordedSteps).toEqual([{ error: null, step: 'completed' }]);
  });

  it('returns unauthorized when the completed-job lookup itself fails after a revoked token', async () => {
    const harness = createHarness({
      completedJobReply: { data: true, error: { message: 'completion lookup unavailable' } },
      userResult: { data: { user: null }, error: { message: 'session revoked' } },
    });

    const response = await harness.handler(await createSignedDeleteRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid_jwt',
      error: 'session revoked',
    });
  });
});
