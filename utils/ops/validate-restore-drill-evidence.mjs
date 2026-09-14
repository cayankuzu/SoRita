#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const forbidden = /(?:postgres(?:ql)?:\/\/|supabase\.co\/project\/[^\s]+|service[_-]?role|api[_-]?key|authorization\s*:|bearer\s+[a-z0-9._-]{12,})/iu;

function fail(message) { throw new Error(message); }

export function validateRestoreDrillEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Restore-drill evidence must be a JSON object.');
  const requiredStrings = ['candidateSha', 'completedAt', 'environment', 'providerOperationReference', 'restorePointUtc', 'scope', 'status'];
  for (const field of requiredStrings) if (typeof value[field] !== 'string' || !value[field].trim()) fail(`${field} is required.`);
  if (!SHA.test(value.candidateSha)) fail('candidateSha must be a canonical full SHA.');
  for (const field of ['completedAt', 'restorePointUtc']) if (!ISO_UTC.test(value[field])) fail(`${field} must be a UTC ISO-8601 timestamp.`);
  if (value.environment !== 'isolated-staging') fail('Restore drills must target isolated-staging, never production.');
  if (value.status !== 'passed') fail('Only an explicitly passed drill can satisfy this evidence schema.');
  if (!Array.isArray(value.checks) || value.checks.length < 4 || !value.checks.every((check) => typeof check?.name === 'string' && check.passed === true)) fail('checks must contain at least four named passing validations.');
  if (!Number.isFinite(value.observedRpoMinutes) || value.observedRpoMinutes < 0 || !Number.isFinite(value.observedRtoMinutes) || value.observedRtoMinutes < 0) fail('Observed RPO/RTO must be non-negative numbers of minutes.');
  const serialized = JSON.stringify(value);
  if (forbidden.test(serialized)) fail('Restore-drill evidence appears to contain a secret, database URL, or bearer token.');
  return { candidateSha: value.candidateSha, checks: value.checks.length, status: value.status };
}

function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--file') fail('Usage: validate-restore-drill-evidence.mjs --file <sanitized-evidence.json>.');
  const result = validateRestoreDrillEvidence(JSON.parse(readFileSync(resolve(process.argv[3]), 'utf8')));
  process.stdout.write(`Restore drill evidence for ${result.candidateSha}: PASS (${result.checks} checks).\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
