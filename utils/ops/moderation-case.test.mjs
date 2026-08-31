import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTransitionPayload,
  parseModerationArguments,
  runModerationCommand,
  sanitizeCaseRecord,
} from './moderation-case.mjs';

const caseId = '7d6c5847-8fd2-4f90-8e53-7ee0ccf20be7';
const environment = {
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  SUPABASE_URL: 'https://example.supabase.co',
};

test('mutation parsing is fail-closed and requires explicit confirmation and idempotency', () => {
  assert.throws(
    () => parseModerationArguments(['review', '--case-id', caseId]),
    /mutations require --confirm MODERATION_CASE_TRANSITION/u,
  );
  assert.throws(
    () => parseModerationArguments([
      'sanction',
      '--case-id', caseId,
      '--operator', 'ops:test',
      '--reason', 'Reviewed',
      '--idempotency-key', 'case-op-0001',
      '--confirm', 'MODERATION_CASE_TRANSITION',
    ]),
    /sanction requires --reference/u,
  );
  assert.throws(
    () => parseModerationArguments(['show', '--case-id', 'not-a-uuid']),
    /--case-id must be a UUID/u,
  );
});

test('transition payload contains only the audited RPC contract', () => {
  const options = parseModerationArguments([
    'set-sla',
    '--case-id', caseId,
    '--operator', ' ops:test ',
    '--reason', ' approved policy ',
    '--idempotency-key', ' case-op-0002 ',
    '--reference', 'policy-v1',
    '--sla-due-at', '2030-01-01T12:00:00+03:00',
    '--confirm', 'MODERATION_CASE_TRANSITION',
  ]);

  assert.deepEqual(buildTransitionPayload(options), {
    p_action: 'set-sla',
    p_case_id: caseId,
    p_idempotency_key: 'case-op-0002',
    p_operator_id: 'ops:test',
    p_reason: 'approved policy',
    p_reference: 'policy-v1',
    p_sla_due_at: '2030-01-01T09:00:00.000Z',
  });
});

test('read commands request only minimum case fields and discard unexpected sensitive fields', async () => {
  let requestedUrl = '';
  const result = await runModerationCommand(
    parseModerationArguments(['list', '--status', 'open', '--limit', '10']),
    {
      environment,
      fetchImpl: async (url, init) => {
        requestedUrl = String(url);
        assert.equal(init.headers.apikey, environment.SUPABASE_SERVICE_ROLE_KEY);
        assert.equal(init.method, 'GET');
        return new Response(JSON.stringify([{
          assigned_operator_id: null,
          closed_at: null,
          created_at: '2026-08-30T00:00:00Z',
          email: 'must-not-escape@example.test',
          id: caseId,
          last_event_at: '2026-08-30T00:00:00Z',
          report_id: '7d6c5847-8fd2-4f90-8e53-7ee0ccf20be8',
          revision: 1,
          sanction_reference: null,
          sla_due_at: null,
          sla_policy_version: null,
          snapshot: { secret: true },
          status: 'open',
          updated_at: '2026-08-30T00:00:00Z',
        }]), { headers: { 'Content-Type': 'application/json' }, status: 200 });
      },
    },
  );

  assert.match(requestedUrl, /moderation_cases/u);
  assert.match(requestedUrl, /status=eq\.open/u);
  assert.equal(JSON.stringify(result).includes('must-not-escape'), false);
  assert.equal(JSON.stringify(result).includes('snapshot'), false);
});

test('mutation calls the single audited RPC and returns a sanitized case', async () => {
  const options = parseModerationArguments([
    'review',
    '--case-id', caseId,
    '--operator', 'ops:test',
    '--reason', 'Review started',
    '--idempotency-key', 'case-op-0003',
    '--confirm', 'MODERATION_CASE_TRANSITION',
  ]);
  let requestBody;
  const result = await runModerationCommand(options, {
    environment,
    fetchImpl: async (url, init) => {
      assert.match(String(url), /rpc\/moderation_transition_case$/u);
      assert.equal(init.method, 'POST');
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({
        assigned_operator_id: 'ops:test',
        closed_at: null,
        created_at: '2026-08-30T00:00:00Z',
        id: caseId,
        last_event_at: '2026-08-30T00:01:00Z',
        report_id: '7d6c5847-8fd2-4f90-8e53-7ee0ccf20be8',
        revision: 2,
        sanction_reference: null,
        sla_due_at: null,
        sla_policy_version: null,
        status: 'in_review',
        updated_at: '2026-08-30T00:01:00Z',
      }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
    },
  });

  assert.deepEqual(requestBody, buildTransitionPayload(options));
  assert.equal(result.status, 'in_review');
  assert.equal(Object.hasOwn(result, 'snapshot'), false);
});

test('sanitizer never passes through arbitrary report fields', () => {
  const result = sanitizeCaseRecord({
    created_at: 'now',
    details: 'private details',
    id: caseId,
    last_event_at: 'now',
    reason: 'private reason',
    report_id: 'report-id',
    revision: 1,
    snapshot: { private: true },
    status: 'open',
    updated_at: 'now',
  });
  assert.equal(Object.hasOwn(result, 'details'), false);
  assert.equal(Object.hasOwn(result, 'reason'), false);
  assert.equal(Object.hasOwn(result, 'snapshot'), false);
});
