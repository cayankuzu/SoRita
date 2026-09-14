#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fullSha = /^[0-9a-f]{40}$/u;
function fail(errors) { throw new Error(`Android Play Internal workflow check failed:\n- ${errors.join('\n- ')}`); }

export function validateAndroidPlayInternalWorkflow({ easConfig, workflow }) {
  const errors = [];
  const submit = easConfig.submit?.production?.android;
  if (submit?.applicationId !== 'com.cayan.sorita.socialmap') errors.push('submit.production.android.applicationId is missing or changed.');
  if (submit?.track !== 'internal' || submit?.releaseStatus !== 'completed') errors.push('Android submit must target the completed Play Internal track.');
  for (const marker of ['workflow_dispatch:', 'quality_run_id:', 'database_run_id:', 'confirm_play_internal:', 'actions: read', 'environment: production', 'ref: ${{ inputs.candidate_sha }}', 'CANDIDATE_SHA: ${{ inputs.candidate_sha }}', 'WORKFLOW_SHA: ${{ github.sha }}', 'Explicit Play Internal confirmation is required.', 'verify_and_record "$QUALITY_RUN_ID" quality.yml quality-run.json', 'verify_and_record "$DATABASE_RUN_ID" database-validation.yml database-run.json', 'prerequisiteRuns', '--freeze-credentials', 'verify-production-android-build.mjs', 'eas submit --platform android --profile production --id "$BUILD_ID"', "destination: 'play-internal'", 'eas-production-android-play-internal-receipt.json']) if (!workflow.includes(marker)) errors.push(`workflow is missing ${marker}`);
  const evidenceContractMarkers = ['[[ ! "$run_id" =~ ^[0-9]+$ ]]', 'actions/runs/${run_id}', 'actions/workflows/${workflow_file}', '.workflow_id|tostring', '.head_repository.full_name', '.repository.full_name', '"$status" != completed', '"$conclusion" != success', '"${head_sha,,}" != "${CANDIDATE_SHA,,}"', '"$workflow_id" != "$expected_id"', '"$head_repository" != "$GITHUB_REPOSITORY"', '"$repository" != "$GITHUB_REPOSITORY"'];
  if (evidenceContractMarkers.some((marker) => !workflow.includes(marker))) errors.push('workflow must verify numeric, successful, same-repository Quality and Database runs for the exact candidate SHA.');
  if (/^\s{2}pull_request(?:_target)?:/mu.test(workflow)) errors.push('workflow cannot run from a pull request event.');
  if (/--latest\b/u.test(workflow) || /eas submit[^\n]*--verbose/iu.test(workflow)) errors.push('workflow must submit the exact verified build without verbose output.');
  if (/serviceAccountKeyPath|GOOGLE_SERVICE_ACCOUNT|service-account[^\n]*\.json/iu.test(workflow)) errors.push('workflow must not materialize or reference a repository service-account key.');
  const sourceGate = workflow.indexOf('The dispatch, workflow and checked-out source must be the exact same SHA.');
  const evidenceGate = workflow.indexOf('Verify successful same-SHA Quality and Database Validation runs');
  const easSetup = workflow.indexOf('Set up pinned EAS CLI');
  const build = workflow.indexOf('eas build \\');
  const verify = workflow.indexOf('verify-production-android-build.mjs');
  const submitIndex = workflow.indexOf('eas submit --platform android');
  if (sourceGate < 0 || evidenceGate < sourceGate || easSetup < evidenceGate || build < easSetup || verify < build || submitIndex < verify) errors.push('exact-SHA/evidence gates, EAS setup, build verification, and submit order is invalid.');
  for (const match of workflow.matchAll(/^\s*uses:\s+([^@\s]+)@([^\s]+)/gmu)) if (!fullSha.test(match[2])) errors.push(`${match[1]} action must be pinned by a full SHA.`);
  if (errors.length) fail(errors);
  return { applicationId: submit.applicationId, destination: 'play-internal', productionTrigger: 'workflow_dispatch' };
}

export function checkRepository(root = process.cwd()) {
  return validateAndroidPlayInternalWorkflow({ easConfig: JSON.parse(readFileSync(resolve(root, 'eas.json'), 'utf8')), workflow: readFileSync(resolve(root, '.github/workflows/eas-production-android-internal.yml'), 'utf8') });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  checkRepository();
  process.stdout.write('Android Play Internal workflow policy: PASS\n');
}
