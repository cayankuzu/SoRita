import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRestoreDrillEvidence } from './validate-restore-drill-evidence.mjs';

const evidence = { candidateSha: 'a'.repeat(40), completedAt: '2026-09-14T12:00:00Z', environment: 'isolated-staging', providerOperationReference: 'provider-operation-123', restorePointUtc: '2026-09-14T11:45:00Z', scope: 'database-and-storage-sample', status: 'passed', observedRpoMinutes: 15, observedRtoMinutes: 22, checks: [{ name: 'schema', passed: true }, { name: 'rls', passed: true }, { name: 'auth', passed: true }, { name: 'storage', passed: true }] };

test('restore-drill evidence demands an isolated, sanitized passing drill', () => {
  assert.equal(validateRestoreDrillEvidence(evidence).status, 'passed');
  assert.throws(() => validateRestoreDrillEvidence({ ...evidence, environment: 'production' }));
  assert.throws(() => validateRestoreDrillEvidence({ ...evidence, providerOperationReference: 'Bearer secret-token-value-12345' }));
});
