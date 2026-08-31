# Security Incident Response

> Status: operational ownership, external escalation routes, legal/privacy
> contacts, provider audit access and exercised response evidence are
> `UNVERIFIED` as of 2026-08-30. Owner: `OWNER_TBD`. This document is a response
> procedure, not evidence that the procedure has been exercised.

## Scope

Use this runbook for suspected or confirmed:

- credential, signing key, token or secret exposure;
- unauthorized account, database, Storage, Worker, EAS or provider access;
- bypass of authentication, RLS, HMAC origin protection or rate limits;
- personal-data exposure, unexpected public object access or abusive scraping;
- malicious package/build/release activity or compromised CI/CD identity;
- integrity loss, destructive activity or security-driven service outage;
- high-risk user-generated content where safety or preservation obligations
  require security incident handling.

Do not invent a numeric severity, response SLA or notification deadline while
triaging. The incident owner and applicable legal/privacy owner must classify
the event using the approved organizational policy and applicable law. Both are
`OWNER_TBD` in current repository evidence.

## Immediate rules

1. Assign an incident identifier, UTC start time and owner. If none has accepted
   responsibility, use `OWNER_TBD` and escalate; do not imply ownership.
2. Preserve volatile evidence before changing configuration where doing so does
   not prolong material harm. Record provider operation/audit IDs, not secrets.
3. Contain the smallest affected scope. Avoid broad credential rotation that
   destroys correlation or causes an unplanned outage without a dependency map.
4. Never paste tokens, database URLs, signing keys, authorization headers,
   personal data or user-generated content into chat, tickets or repository
   artifacts.
5. Treat screenshots and exports as sensitive until reviewed and sanitized.
6. Do not announce cause, scope or affected users before it is verified and the
   authorized communications/legal owner approves the wording.

Evidence root: `artifacts/release-evidence/manual/security-incidents/<incident-id>/`.
This path must contain sanitized metadata only and must not become a secret or
personal-data archive.

## Triage and classification

Record:

- detection source, UTC timestamps and reporter;
- affected environment, provider, app build/runtime, Worker version and commit;
- observed behavior versus verified facts;
- potentially affected identities/data classes, expressed as aggregates where
  possible;
- current access path and whether exploitation is ongoing;
- containment action, decision owner and provider audit reference;
- regulatory/contractual assessment owner (`OWNER_TBD`).

Preserve relevant Sentry event IDs, Cloudflare `requestId`/`cfRay`, Supabase log
references, CI run IDs and release/deployment IDs. Export only what the approved
retention and privacy policy permits.

## Containment decision tree

| Observation | Least-expansive containment | Required follow-up |
| --- | --- | --- |
| Mobile public configuration appears exposed | Determine whether the value is intended public configuration; do not treat a publishable key as a service-role key | Validate RLS and actual access; rotate only if policy requires it |
| Supabase service-role or function secret exposed | Revoke/rotate at provider, restrict affected function/project access | Redeploy dependents, review audit logs, run negative authorization/RLS tests |
| Cloudflare API token exposed | Revoke the exact token and issue a least-privilege replacement | Update CI secret, verify deploy/auth, inspect account audit logs |
| Origin HMAC material exposed | Keep or return mobile edge cutover to `direct` if safe, rotate edge and origin atomically | Confirm origin validation exists and rejects old/invalid signatures before edge traffic resumes |
| Expo/EAS token exposed | Revoke token and stop unauthorized build/update activity | Replace CI secret, inspect builds/updates, validate channel/runtime targeting |
| Android/iOS signing credential exposed | Escalate to store/signing owner; do not improvise key replacement | Follow platform-specific recovery, revoke what is revocable, assess malicious-build risk |
| Sentry token/DSN issue | Revoke privileged token; separately assess DSN abuse and ingestion controls | Replace CI secret, inspect project access/events and data exposure |
| Public access to private Storage object | Remove public reachability only after preserving metadata and scoping impact | Audit references/policies, verify unauthorized access fails, follow privacy/legal assessment |
| Malicious release/canary | Stop promotion and roll back to last verified version | Preserve run IDs, identify compromised identity/change, rebuild from a clean candidate |

## Credential rotation order

Use the detailed panel locations and verification commands in
[`docs/MANUAL_STEPS.md`](./MANUAL_STEPS.md). Record variable **names**, never
values.

1. Freeze the affected deploy/promote path and preserve its audit trail.
2. Revoke the compromised credential at its authority/provider.
3. Create a least-privilege replacement through the approved secret manager.
4. Update each dependent environment without printing the value.
5. Redeploy only the affected component from an immutable reviewed commit.
6. Verify a positive path and an authorization-negative path.
7. Confirm the old credential no longer works.
8. Monitor for retry storms, access denials and unexpected deployments.
9. Record completion by system and owner.

### Coordinated origin HMAC rotation

The working tree now contains matching Worker signing, Supabase origin
verification and a nonce-claim migration for the five selected Functions. The
origin code deliberately preserves direct compatibility until
`CLOUDFLARE_ORIGIN_SIGNATURE_REQUIRED` is enabled. These sources are
uncommitted/unapplied and provider state is `UNVERIFIED`; HMAC cutover therefore
remains `NO-GO`, and `EXPO_PUBLIC_EDGE_CUTOVER_MODE` must remain `direct` until
same-SHA local, staging deployment and external negative tests pass.

Do not set a new edge secret and assume the origin is protected. A safe rotation
requires coordinated Worker `ORIGIN_HMAC_SECRET` and Supabase
`CLOUDFLARE_ORIGIN_HMAC_SECRET` material, an approved overlap or versioned-key
strategy, bounded timestamp and atomic nonce checks, rejection of
missing/invalid/expired/replayed signatures, and proof that direct unsigned
origin requests fail after enforcement is enabled. Enabling
`CLOUDFLARE_ORIGIN_SIGNATURE_REQUIRED` also requires proof that every supported
installed binary uses the Worker or an approved old-binary retirement plan;
otherwise direct legacy clients will fail. If any gate is absent, follow the
recorded compatibility rollback, accurately mark the origin open when the flag
is disabled, and investigate.

## Investigation

Build a UTC timeline from immutable provider and CI references. Answer, without
speculation:

- what identity or path performed the action;
- what permissions it had and why;
- which environments, data classes and users may be affected;
- when access began, ended and was contained;
- which releases/configuration changes overlap the event;
- whether logs are complete enough to support the conclusion;
- whether persistence, replay or secondary credentials exist.

Unknowns remain `UNVERIFIED`. Absence of logs is not evidence of absence.

## Recovery and validation

From a clean candidate commit, run the relevant repository checks:

```powershell
npm run security:verify
npm run check:release
npm --prefix infra/cloudflare/sorita-edge run check
supabase db lint --local --level error
supabase test db --local
```

Then verify, in the affected external environment:

- revoked credentials fail and replacements have least privilege;
- RLS, Auth, signed URLs, bucket privacy and function authorization behave as
  designed, including negative tests;
- Worker HMAC checks exist on both sides before any edge cutover;
- the exact restored/released commit and provider version are recorded;
- Sentry/logging still receives sanitized test events;
- canary health is approved before broader traffic resumes.

Repository checks do not substitute for provider or real-device evidence.

## Communications and notification

The incident owner must route facts to security, privacy/legal, product and
communications owners according to an approved organizational policy. Those
owners and routes are currently `OWNER_TBD`. Preserve decision timestamps and
approved wording. Do not notify users, stores, regulators or third parties from
this runbook alone; applicable requirements depend on verified facts and
jurisdiction-specific advice.

## Closure

Closure requires:

- containment and recovery evidence;
- documented credential revocations and residual access review;
- verified impact scope and remaining unknowns;
- privacy/legal and communications disposition where applicable;
- corrective actions with owners, not just observations;
- a sanitized post-incident review and evidence-retention decision;
- confirmation that temporary access, exceptions and restored environments were
  removed or formally retained.

Until an owner accepts the evidence and residual risk, status remains
`UNVERIFIED`/`NO-GO` for affected releases.
