import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/media-upload-sweeper.yml'),
  'utf8',
);

test('media upload sweeper is scheduled, protected and bounded', () => {
  assert.match(workflow, /schedule:\s*\n\s+- cron: '17 \* \* \* \*'/u);
  assert.match(workflow, /environment: production/u);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /timeout-minutes: 15/u);
  assert.match(workflow, /npm ci --ignore-scripts --omit=dev/u);
  assert.match(workflow, /SORITA_MEDIA_SWEEP_CONFIRM: SWEEP_STALE_MEDIA_UPLOADS/u);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/u);
  assert.match(workflow, /ops:media-uploads:sweep -- --limit 100 --max-batches 10/u);
  assert.match(workflow, /if: failure\(\)/u);
});

test('media upload sweeper has no untrusted trigger and pins critical actions', () => {
  assert.doesNotMatch(workflow, /pull_request(?:_target)?:/u);
  assert.doesNotMatch(workflow, /push:/u);
  for (const match of workflow.matchAll(/uses:\s+(actions\/(?:checkout|setup-node))@([^\s]+)/gu)) {
    assert.match(match[2], /^[0-9a-f]{40}$/u, `${match[1]} must be SHA-pinned`);
  }
});
