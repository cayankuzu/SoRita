import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { checkRepository, validateAndroidPlayInternalWorkflow } from '../check-android-play-internal-workflow.mjs';

function inputs() { return { easConfig: JSON.parse(readFileSync(resolve(process.cwd(), 'eas.json'), 'utf8')), workflow: readFileSync(resolve(process.cwd(), '.github/workflows/eas-production-android-internal.yml'), 'utf8') }; }

test('protected Android Internal delivery uses the exact verified provider build', () => {
  assert.deepEqual(checkRepository(), { applicationId: 'com.cayan.sorita.socialmap', destination: 'play-internal', productionTrigger: 'workflow_dispatch' });
});

test('Android Internal delivery rejects a local service-account path and latest build submit', () => {
  const unsafe = inputs();
  unsafe.workflow += '\n# GOOGLE_SERVICE_ACCOUNT_KEY\neas submit --latest\n';
  assert.throws(() => validateAndroidPlayInternalWorkflow(unsafe), /service-account|exact verified build/u);
});

test('Android Internal delivery rejects weakened prerequisite run identity checks', () => {
  const unsafe = inputs();
  unsafe.workflow = unsafe.workflow
    .replace('"$workflow_id" != "$expected_id"', '"$workflow_id" == "$expected_id"')
    .replace(
      '"$repository" != "$GITHUB_REPOSITORY"',
      '"$repository" == "$GITHUB_REPOSITORY"',
    );

  assert.throws(
    () => validateAndroidPlayInternalWorkflow(unsafe),
    /numeric, successful, same-repository Quality and Database runs/u,
  );
});

test('Android Internal delivery rejects a prerequisite gate placed after EAS Build', () => {
  const unsafe = inputs();
  unsafe.workflow = unsafe.workflow.replace(
    'Verify successful same-SHA Quality and Database Validation runs',
    'Verify prerequisite workflow runs',
  );
  unsafe.workflow += '\n# Verify successful same-SHA Quality and Database Validation runs\n';

  assert.throws(
    () => validateAndroidPlayInternalWorkflow(unsafe),
    /exact-SHA\/evidence gates, EAS setup, build verification, and submit order is invalid/u,
  );
});
