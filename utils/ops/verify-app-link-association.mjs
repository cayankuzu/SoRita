#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const iosBundleId = 'com.cayan.sorita.socialmap';
const androidPackageId = 'com.cayan.sorita.socialmap';
const appleTeamId = 'HBRG8P523Z';
const fingerprintPattern = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/u;

function fail(message) {
  throw new Error(message);
}

export function normalizeDomain(value) {
  const candidate = value?.trim().toLowerCase() ?? '';
  if (!candidate) fail('EXPO_PUBLIC_APP_LINK_DOMAIN or --domain is required.');
  try {
    const parsed = new URL(`https://${candidate}`);
    if (
      parsed.hostname !== candidate || parsed.port || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash ||
      candidate === 'localhost' || candidate.endsWith('.localhost')
    ) fail('invalid');
    return parsed.hostname;
  } catch {
    fail('App-link domain must be a public hostname without a scheme, path, port, credentials, query, or fragment.');
  }
}

function parseOptions(argv) {
  const templatesOnly = argv.length === 1 && argv[0] === '--templates-only';
  if (templatesOnly) return { templatesOnly };
  if (argv.length > 0 && (argv.length !== 2 || argv[0] !== '--domain')) {
    fail('Usage: verify-app-link-association.mjs [--templates-only | --domain <hostname>].');
  }
  return { domain: argv[1] ?? process.env.EXPO_PUBLIC_APP_LINK_DOMAIN, templatesOnly: false };
}

export function verifyTemplates(root = repositoryRoot) {
  const aasa = JSON.parse(readFileSync(resolve(root, 'ops/link-association/apple-app-site-association.template.json'), 'utf8'));
  const assetLinks = JSON.parse(readFileSync(resolve(root, 'ops/link-association/assetlinks.template.json'), 'utf8'));
  if (aasa?.applinks?.details?.[0]?.appID !== '__APPLE_TEAM_ID__.__IOS_BUNDLE_ID__') {
    fail('AASA template must retain explicit Apple team and bundle-ID placeholders.');
  }
  const target = assetLinks?.[0]?.target;
  if (target?.namespace !== 'android_app' || target?.package_name !== '__ANDROID_PACKAGE_ID__' || target?.sha256_cert_fingerprints?.[0] !== '__ANDROID_SHA256_CERT_FINGERPRINT__') {
    fail('assetlinks template must retain Android package and SHA-256 certificate placeholders.');
  }
}

async function responseJson(url, fetchImpl) {
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) fail(`${new URL(url).pathname} returned HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) fail(`${new URL(url).pathname} must return application/json.`);
  try { return await response.json(); } catch { fail(`${new URL(url).pathname} did not return valid JSON.`); }
}

export async function verifyHostedAssociation({ domain, androidFingerprint, fetchImpl = fetch }) {
  const host = normalizeDomain(domain);
  const fingerprint = androidFingerprint?.trim().toUpperCase() ?? '';
  if (!fingerprintPattern.test(fingerprint)) fail('SORITA_ANDROID_APP_LINK_CERT_SHA256 must be an uppercase colon-delimited SHA-256 fingerprint.');
  const root = `https://${host}`;
  const [aasa, assetLinks] = await Promise.all([
    responseJson(`${root}/.well-known/apple-app-site-association`, fetchImpl),
    responseJson(`${root}/.well-known/assetlinks.json`, fetchImpl),
  ]);
  const appId = `${appleTeamId}.${iosBundleId}`;
  if (!aasa?.applinks?.details?.some((entry) => entry?.appID === appId)) fail('Hosted AASA does not authorize the SoRita iOS app identifier.');
  if (!assetLinks.some((entry) => entry?.relation?.includes('delegate_permission/common.handle_all_urls') && entry?.target?.namespace === 'android_app' && entry.target.package_name === androidPackageId && entry.target.sha256_cert_fingerprints?.includes(fingerprint))) {
    fail('Hosted assetlinks.json does not authorize the Android package and upload/app-signing certificate fingerprint.');
  }
  return { androidPackageId, domain: host, iosAppId: appId };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  verifyTemplates();
  if (options.templatesOnly) {
    process.stdout.write('App-link association templates: PASS\n');
    return;
  }
  const result = await verifyHostedAssociation({
    domain: options.domain,
    androidFingerprint: process.env.SORITA_ANDROID_APP_LINK_CERT_SHA256,
  });
  process.stdout.write(`App-link association verified for ${result.domain}: PASS\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
