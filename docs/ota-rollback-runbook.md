# SoRita OTA And Edge Rollback Runbook

Last command verification: 2026-08-30 against the official EAS CLI reference and the repository's
locked Wrangler `4.127.1` help output. No provider command in this runbook has been executed.

> **Operational status: NO-GO / UNVERIFIED.** Provider dashboards, deployed versions, signed
> artifacts, production secrets, monitoring, and real-device rollback behavior have not been
> evidenced. Placeholders must be replaced from the incident record; never guess an ID or runtime.

## Safety rules

1. Assign an incident commander, freeze OTA/native/edge releases, and record the incident ID,
   affected channel, runtime, source SHA, update group, Worker deployment/version, first-seen time,
   and blast radius.
2. Preserve EAS, Cloudflare, Sentry, Supabase, store, and device evidence before mutation. Do not
   paste tokens, request bodies, user identifiers, raw IPs, or secrets into the incident record.
3. Confirm whether the EAS update is an active partial rollout or a completed rollout. The commands
   are different; do not run both paths.
4. Confirm persistent client state remains backward compatible. An older JavaScript bundle can be
   unsafe after incompatible AsyncStorage/file/schema changes; use a tested forward fix instead.
5. A rollback affects only matching runtime/channel clients that next check for an update. It does
   not replace a native binary, undo a database migration, restore a Cloudflare binding/secret, or
   guarantee that already-running clients restart.
6. If EAS Update code signing is later enabled, every rollback publication must follow the approved
   private-key procedure. It is currently **UNVERIFIED**, so this runbook does not claim a signed
   rollback artifact.

## Capture state before containment

Use the production channel below only when production is the affected environment; substitute the
actual isolated channel otherwise.

```bash
eas channel:view production --json --non-interactive
eas update:view <BAD_GROUP_ID> --insights --days 1 --json
eas update:list --all --runtime-version <AFFECTED_RUNTIME> --limit 25 --json --non-interactive
```

Verify that `<BAD_GROUP_ID>` belongs to the intended project, channel branch, runtime, target SHA,
and both platforms. If any identity is ambiguous, stop: **NO-GO for rollback mutation**.

## A. Revert an active 5/20/50% EAS rollout

For an update group that is still in a per-update rollout, revert the rollout itself:

```bash
eas update:revert-update-rollout \
  --group <BAD_GROUP_ID> \
  --message "<INCIDENT_ID>: revert active production rollout" \
  --json --non-interactive
```

This returns affected users to the control update. When the branch had no previous update, EAS
creates a rollback-to-embedded update. An active rollout must be ended or reverted before another
update with the same runtime can be published.

Verify the result:

```bash
eas update:view <BAD_GROUP_ID> --json
eas update:list --all --runtime-version <AFFECTED_RUNTIME> --limit 10 --json --non-interactive
```

## B. Roll back a completed update to the previous update

If the bad group is the latest group for its branch and runtime, use the deterministic
non-interactive rollback command:

```bash
eas update:rollback <BAD_GROUP_ID> \
  --message "<INCIDENT_ID>: restore previous production update" \
  --platform all --json --non-interactive
```

EAS republishes the preceding update; if none exists, it publishes a rollback-to-embedded directive.
The `<BAD_GROUP_ID>` argument is required in non-interactive mode and must be the latest group for
that branch/runtime.

When the incident record identifies a specific backward-compatible last-good group, use this
explicit alternative instead. Do not run both commands:

```bash
eas update:republish \
  --group <LAST_GOOD_GROUP_ID> \
  --destination-channel production \
  --message "<INCIDENT_ID>: republish approved last-good group" \
  --platform all --json --non-interactive
```

Do not republish an older bundle until its persisted-state and edge/origin contracts have been
tested against current user data.

## C. Roll back to the embedded update

Use this only when the exact embedded update in both affected binaries is known healthy and the
runtime is taken from those binaries:

```bash
eas update:roll-back-to-embedded \
  --channel production \
  --runtime-version <AFFECTED_RUNTIME> \
  --message "<INCIDENT_ID>: return to verified embedded update" \
  --platform all --json --non-interactive
```

For the currently configured binary generation, the expected runtime is `1.0.101`; never substitute
that value blindly for older installed binaries. If Android and iOS have different verified runtime
or embedded-state evidence, contain each platform separately with `--platform android` or
`--platform ios`.

## D. Wrong-runtime or native-incompatible update

First inspect the published group and the actually affected binary runtime:

```bash
eas update:view <BAD_GROUP_ID> --json
eas update:list --all --runtime-version <AFFECTED_RUNTIME> --limit 25 --json --non-interactive
```

- If the group truly targets a different runtime, it cannot repair clients on
  `<AFFECTED_RUNTIME>`. Roll back the bad group's own runtime with the command from section B, then
  publish or republish only a verified bundle for the affected runtime.
- If a native change was shipped while the app version/runtime remained unchanged, treat it as
  `NATIVE_BUILD_REQUIRED`: immediately roll back the group, change the app version under an approved
  native release, and ship new Android and iOS binaries. Do not relabel or republish the incompatible
  bundle under another runtime.
- If there is no safe previous group for the affected runtime, use the exact-runtime embedded command
  from section C only after embedded compatibility is evidenced; otherwise fix forward.

For the first case, explicitly target the bad group on its own runtime:

```bash
eas update:rollback <WRONG_RUNTIME_BAD_GROUP_ID> \
  --message "<INCIDENT_ID>: remove update from wrong runtime" \
  --platform all --json --non-interactive
```

If that runtime has no safe previous update but its embedded binary is verified, use this instead;
do not run both commands:

```bash
eas update:roll-back-to-embedded \
  --channel production \
  --runtime-version <AFFECTED_RUNTIME> \
  --message "<INCIDENT_ID>: restore embedded bundle for affected runtime" \
  --platform all --json --non-interactive
```

Runtime isolation prevents delivery to nonmatching clients, but it does not protect clients when an
incompatible native change was mistakenly left on the same app-version runtime.

## E. Broken edge gateway

Decide whether the regression is in the mobile OTA, the deployed Worker, its external configuration,
or Supabase origin behavior. Two independent containment actions may be required.

### Mobile update enabled or depended on the broken edge path

Return the mobile channel to the last-good direct/gateway behavior using section A or B. For a
completed bad update:

```bash
eas update:rollback <EDGE_ENABLING_BAD_GROUP_ID> \
  --message "<INCIDENT_ID>: restore last-good edge routing behavior" \
  --platform all --json --non-interactive
```

Do not assume direct-origin fallback is available: production origin-bypass state and the stable API
hostname are provider-side **UNVERIFIED** evidence.

### Cloudflare Worker code regression

Run from `infra/cloudflare/sorita-edge`. `--no-install` prevents an incident-time download of a
different Wrangler version.

```bash
npx --no-install wrangler deployments list --env production --json
npx --no-install wrangler versions view <LAST_GOOD_WORKER_VERSION_ID> --env production --json
npx --no-install wrangler rollback <LAST_GOOD_WORKER_VERSION_ID> \
  --env production \
  --message "<INCIDENT_ID>: restore verified last-good Worker" \
  --yes
npx --no-install wrangler deployments list --env production --json
```

Cloudflare rollback immediately creates a deployment that sends 100% of Worker traffic to the
selected version; it is not a canary. It does not roll back KV/R2/D1/Durable Object data, secrets, or
external resources. A rollback can be rejected or remain broken when required bindings were removed
or their resource shape changed. In that case, keep the release frozen and use an approved forward
fix for configuration/resources.

After either containment path, verify the approved stable hostname without placing credentials in
the command:

```bash
curl --fail-with-body --silent --show-error https://<APPROVED_STABLE_API_HOST>/health
```

Then exercise each exact Worker route with synthetic, non-PII test identities and verify that unknown
methods/paths, trailing slashes, query strings, invalid JWTs, oversized bodies, and media bytes still
fail closed.

## Post-rollback verification

Keep the release frozen until all applicable evidence is retained:

- EAS channel/update group now resolves to the intended previous or embedded state for the exact
  runtime and both platforms.
- OTA-enabled physical Android and iOS devices fetch the rollback, fully terminate, restart, and run
  the intended bundle; offline embedded/cached recovery also passes.
- Crash-free sessions, update launch errors, auth failures, feed/mutation latency, uploads, and edge
  `5xx`/timeouts recover through an agreed observation window.
- Cloudflare deployment shows the intended Worker version at 100%, `/health` and all selected routes
  pass, and bindings/secrets/origin HMAC compatibility are independently verified.
- No irreversible client-state, database, storage, or queue incompatibility was introduced.
- Incident timeline records operator, command, group/version IDs, UTC timestamps, dashboards,
  artifact hashes, device matrix, and final decision without secrets or PII.

## Evidence status

| Evidence | Status | Decision |
| --- | --- | --- |
| EAS/Cloudflare provider dashboards and current production IDs | **UNVERIFIED** | **NO-GO** |
| Signed Android/iOS artifact hashes and provenance | **UNVERIFIED** | **NO-GO** |
| EAS Update code-signing certificate/private-key chain | **UNVERIFIED / not claimed** | **NO-GO for signed-update claims** |
| Physical Android/iOS rollback and cold-start behavior | **UNVERIFIED** | **NO-GO** |
| Cloudflare production route, binding, secret, and version state | **UNVERIFIED** | **NO-GO** |
| Sentry/EAS/Cloudflare/Supabase alert and SLO recovery | **UNVERIFIED** | **NO-GO** |

## Authoritative references

- [Expo: rollbacks](https://docs.expo.dev/eas-update/rollbacks/)
- [Expo: rollouts](https://docs.expo.dev/eas-update/rollouts/)
- [Expo: error recovery](https://docs.expo.dev/eas-update/error-recovery/)
- [Expo: CLI reference](https://docs.expo.dev/eas/cli/)
- [Cloudflare Workers: rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Cloudflare Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
