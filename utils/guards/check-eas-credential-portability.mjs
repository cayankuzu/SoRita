#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const PRIVATE_PATH_FIELDS = new Set([
  "ascApiKeyPath",
  "serviceAccountKeyPath",
  "provisioningProfilePath",
  "keystorePath",
]);

function collectPrivatePathFields(value, path = "eas") {
  const matches = [];
  if (!value || typeof value !== "object") return matches;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (PRIVATE_PATH_FIELDS.has(key)) matches.push(childPath);
    matches.push(...collectPrivatePathFields(child, childPath));
  }
  return matches;
}

function fail(errors) {
  throw new Error(
    `EAS credential portability check failed:\n- ${errors.join("\n- ")}`,
  );
}

export function validateEasCredentialPortability({
  easConfig,
  easIgnore,
  gitIgnore,
  appConfig,
  workflow,
}) {
  const errors = [];
  const profiles = ["development", "preview", "production"];
  for (const profile of profiles) {
    if (easConfig.build?.[profile]?.credentialsSource !== "remote") {
      errors.push(`build.${profile}.credentialsSource must be remote`);
    }
  }
  if (easConfig.cli?.requireCommit !== true)
    errors.push("cli.requireCommit must be true");

  const privatePathFields = collectPrivatePathFields(easConfig);
  if (privatePathFields.length > 0) {
    errors.push(
      `tracked private credential paths are forbidden: ${privatePathFields.join(", ")}`,
    );
  }
  if (/AuthKey_[A-Z0-9]+\.p8/iu.test(JSON.stringify(easConfig))) {
    errors.push(
      "eas.json must not name a repository-local App Store Connect key",
    );
  }

  const iosSubmit = easConfig.submit?.production?.ios;
  const expectedBundleId = "com.cayan.sorita.socialmap";
  if (iosSubmit?.bundleIdentifier !== expectedBundleId) {
    errors.push("submit.production.ios.bundleIdentifier changed or is missing");
  }
  if (!/^\d{8,12}$/u.test(iosSubmit?.ascAppId ?? "")) {
    errors.push(
      "submit.production.ios.ascAppId must remain a numeric provider app ID",
    );
  }
  if (!/^[A-Z0-9]{10}$/u.test(iosSubmit?.appleTeamId ?? "")) {
    errors.push(
      "submit.production.ios.appleTeamId must remain a valid team ID",
    );
  }
  for (const identityPattern of [
    /package:\s*['"]com\.cayan\.sorita\.socialmap['"]/u,
    /bundleIdentifier:\s*['"]com\.cayan\.sorita\.socialmap['"]/u,
  ]) {
    if (!identityPattern.test(appConfig))
      errors.push("native package/bundle identity changed or is missing");
  }

  for (const [name, source] of [
    [".gitignore", gitIgnore],
    [".easignore", easIgnore],
  ]) {
    for (const marker of [
      "*.p8",
      "AuthKey_*.p8",
      "credentials.json",
      ".eas-submit/",
    ]) {
      if (!source.split(/\r?\n/u).includes(marker))
        errors.push(`${name} must ignore ${marker}`);
    }
  }

  for (const marker of [
    "workflow_dispatch:",
    "environment: production",
    "ref: ${{ inputs.candidate_sha }}",
    "CANDIDATE_SHA: ${{ inputs.candidate_sha }}",
    "WORKFLOW_SHA: ${{ github.sha }}",
    "EXPO_ASC_API_KEY_BASE64: ${{ secrets.EXPO_ASC_API_KEY_BASE64 }}",
    "EXPO_ASC_KEY_ID: ${{ secrets.EXPO_ASC_KEY_ID }}",
    "EXPO_ASC_ISSUER_ID: ${{ secrets.EXPO_ASC_ISSUER_ID }}",
    "materialize-asc-api-key.mjs",
    "--freeze-credentials",
    "verify-production-ios-build.mjs",
    "eas submit",
    '--id "$BUILD_ID"',
    "if: always()",
    'rm -f -- "$key_path"',
    "eas-production-ios-testflight-receipt.json",
  ]) {
    if (!workflow.includes(marker))
      errors.push(`production iOS workflow is missing ${marker}`);
  }
  if (/^\s{2}pull_request(?:_target)?:/mu.test(workflow)) {
    errors.push("production iOS workflow cannot run from a pull request event");
  }
  if (/--latest\b/u.test(workflow))
    errors.push("production submission must use an exact verified build ID");
  if (/eas submit[^\n]*--verbose/iu.test(workflow))
    errors.push("verbose submission logging is forbidden");
  if (/echo\s+["']?\$EXPO_ASC_/iu.test(workflow))
    errors.push("credential variables must never be echoed");

  const sourceGate = workflow.indexOf(
    "The dispatch, workflow and checked-out source must be the exact same SHA.",
  );
  const buildMutation = workflow.indexOf("eas build \\");
  const buildVerification = workflow.indexOf("verify-production-ios-build.mjs");
  const submitMutation = workflow.indexOf("eas submit \\");
  if (sourceGate < 0 || buildMutation < sourceGate)
    errors.push("exact-SHA gate must precede EAS Build");
  if (buildVerification < buildMutation || submitMutation < buildVerification) {
    errors.push(
      "provider build verification must occur between build and submit",
    );
  }

  for (const match of workflow.matchAll(/^\s*uses:\s+([^@\s]+)@([^\s]+)/gmu)) {
    if (!FULL_SHA_PATTERN.test(match[2]))
      errors.push(`${match[1]} action must be full-SHA pinned`);
  }
  const uploadBlock = workflow.slice(
    workflow.indexOf("uses: actions/upload-artifact@"),
  );
  if (/AuthKey|\.p8|sorita-eas-submit/iu.test(uploadBlock)) {
    errors.push("credential paths must not be included in uploaded artifacts");
  }

  if (errors.length > 0) fail(errors);
  return {
    buildCredentialSource: "remote",
    bundleIdentifier: expectedBundleId,
    ephemeralSubmitCredential: true,
    productionTrigger: "workflow_dispatch",
  };
}

export function checkRepository(root = process.cwd()) {
  return validateEasCredentialPortability({
    appConfig: readFileSync(resolve(root, "app.config.ts"), "utf8"),
    easConfig: JSON.parse(readFileSync(resolve(root, "eas.json"), "utf8")),
    easIgnore: readFileSync(resolve(root, ".easignore"), "utf8"),
    gitIgnore: readFileSync(resolve(root, ".gitignore"), "utf8"),
    workflow: readFileSync(
      resolve(root, ".github/workflows/eas-production-ios.yml"),
      "utf8",
    ),
  });
}

function main() {
  checkRepository();
  process.stdout.write("EAS credential portability policy: PASS\n");
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
