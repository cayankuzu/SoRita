# Moderation Without an Admin Panel

> Status: the app has report/block flows, server-side objectionable-content
> checks and a durable report intake. The current working tree also contains an
> **uncommitted/unapplied** moderation case ledger, append-only event ledger,
> service-role-only transition RPC, pgTAP tests and a bounded CLI. There is no
> moderator/admin UI, and local CI, staging deployment, operator access, policy,
> response expectation, appeal channel and exercised production evidence remain
> `UNVERIFIED`. Store UGC readiness is `NO-GO` as of 2026-08-30.

Owner: `OWNER_TBD`.

## Existing and candidate contracts

The existing moderation intake:

- requires authentication and verifies reporter identity;
- applies an intake rate limit;
- validates and snapshots the reported target where supported;
- inserts a row into `public.moderation_reports`;
- attempts notification through the configured email provider;
- records email delivery as `pending`, `sent` or `failed`.

Email delivery state is **not** a moderation decision. A failed email does not
remove the database report, and changing `email_delivery_status` does not mark a
case reviewed or resolved.

Working-tree migration
`supabase/migrations/20260830160000_harden_moderation_case_operations.sql`
proposes a separate internal lifecycle:

- one `public.moderation_cases` row per report, including status, assigned
  operator reference, optional SLA due date/policy version, sanction reference,
  revision and timestamps;
- append-only `public.moderation_case_events` entries with transition,
  idempotency, operator, reason and external reference metadata;
- automatic case creation/backfill without copying report details/snapshots into
  event metadata;
- RLS and revoked client privileges; service role can read the minimal ledgers
  and execute `public.moderation_transition_case`;
- source-defined transitions for review, sanction, close, appeal, reopen and
  SLA assignment, with invalid transitions rejected.

The source is not hosted proof. Until database reset/tests and a staging apply
pass, operators must not assume these tables or RPC exist in any provider
environment.

## Operator interface

`utils/ops/moderation-case.mjs` (package script `ops:moderation`) is the current
non-UI interface. It supports bounded list/show/event reads and sends mutations
only through the audited transition RPC after explicit confirmation. It requires
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the process environment.

Run it only on a controlled operator workstation/runner. Obtain the service-role
value from the approved secret manager at execution time; never paste it into a
command, shell history, ticket or artifact. The CLI output intentionally omits
the report body/snapshot, but operator-entered reason/reference text can still
leak personal data. Use approved policy codes and restricted case references,
not raw user content.

## Enablement gate

Before using the candidate case ledger in an external environment:

1. obtain a clean immutable candidate and successful same-SHA Quality/Database
   evidence;
2. apply migrations to isolated staging and run
   `supabase/tests/moderation_ops_security.sql`;
3. run CLI unit tests and staging list/show/events with synthetic reports;
4. verify anonymous/authenticated users cannot read either ledger or execute the
   transition RPC;
5. exercise every allowed and disallowed transition, idempotent replay and
   concurrency behavior;
6. verify output/logs contain no report detail, snapshot, token, email, precise
   location or signed URL;
7. approve operator identity format, access issuance/revocation, policy version,
   escalation, appeal intake, retention and evidence storage;
8. create and test service-role rotation/revocation and rollback procedures.

Missing evidence keeps the operator workflow `NO-GO`.

## Queue triage

After the enablement gate passes, use the bounded CLI rather than ad-hoc table
updates:

```powershell
npm run ops:test
npm run ops:moderation -- list --status open --limit <approved-limit>
npm run ops:moderation -- show --case-id <case-id>
npm run ops:moderation -- events --case-id <case-id> --limit <approved-limit>
```

Expected safe result: only minimal case/event metadata is returned; report text,
snapshot and user profile data are absent. Save aggregate/sanitized output under
`artifacts/release-evidence/manual/moderation/queue-aggregate/`.

If the candidate migration is not deployed, use a provider-approved read-only
aggregate over `public.moderation_reports` only. Do not pretend email-delivery
state supplies the missing case lifecycle.

## Per-case procedure

1. Assign an authorized operator and a restricted external case/evidence
   reference. The case system, retention and accountable owner are `OWNER_TBD`.
2. Use `show` and `events` first. Retrieve report content separately only when
   the assigned operator and policy permit it; do not copy it to CLI evidence.
3. Assess the report against an approved policy version. Policy/training owner:
   `OWNER_TBD`.
4. If there is credible imminent harm, suspected illegality, security impact or
   personal-data exposure, preserve evidence and escalate through
   [`docs/security-incident-response.md`](./security-incident-response.md).
5. Select the least-expansive policy outcome. A `sanction` transition records a
   decision/reference; it does not itself delete content or restrict an account.
6. Obtain required approval before the separately audited enforcement action.
   This runbook supplies no destructive SQL.
7. Invoke the corresponding CLI transition with case ID, operator reference,
   concise policy reason, unique idempotency key and any required external
   reference. Mutations require the checked-in
   `--confirm MODERATION_CASE_TRANSITION` guard; this confirmation is not a
   substitute for owner approval. Never place credentials in the command.
8. Read the case/events again and verify exactly one accepted event/revision.
9. Verify the separately enforced product behavior for the affected account and
   an unauthorized account, with unrelated content unchanged.
10. Record approved notification and appeal handling in the restricted system;
    use `appeal`/`reopen` only when their source-defined preconditions hold.
11. Close only after owner review and retention/evidence obligations are met.

Every retry must reuse the original idempotency key for the same intended
operation. Never reuse it for a different case or decision.

## SLA fields are not an approved SLA

The candidate schema can store a due timestamp and policy-version reference,
but this repository has no approved numeric moderation SLA. `set-sla` may be
used only after an owner approves a policy outside the repository and the
operator records that exact policy reference. Do not derive or claim a deadline
from the mere presence of columns.

## Email delivery failures

The database report remains authoritative when notification fails. Operators
must monitor aggregate `failed` and aging `pending` intake notifications, verify
provider configuration and use an approved retry/re-notification process. Do not
set a row to `sent` unless delivery was actually performed and auditable. The
case status and notification delivery state remain separate.

## Emergency content restriction

For an urgent safety case:

- preserve report/case IDs, target reference and provider audit context;
- assign an incident/case owner (`OWNER_TBD`);
- use the narrowest reversible restriction available under approved policy;
- avoid permanent deletion until evidence-preservation and legal/privacy needs
  are assessed;
- verify the restriction from an unauthorized account/device;
- schedule policy review and provide the approved appeal path.

If only destructive database access is available, stop and obtain explicit
authorization, current backup evidence and a reviewed transaction/rollback
script.

## Store-readiness gaps

Before claiming Apple App Store or Google Play UGC compliance, provide evidence
of:

- published terms/policy prohibiting objectionable content and abuse;
- report and block journeys on real iOS and Android devices;
- timely intake with an accountable trained operator and escalation route;
- deployed, access-controlled and exercised review/enforcement/appeal lifecycle;
- user notification and appeal handling where applicable;
- repeat-abuse handling, privacy/retention rules and operator access review;
- store privacy/data-safety declarations matching actual collection/providers.

Source code for a ledger/CLI alone does not satisfy these gates. Missing evidence
remains `UNVERIFIED`; store release remains `NO-GO`.

## Evidence

Store sanitized artifacts under `artifacts/release-evidence/manual/moderation/`:

- `migration-and-pgtap/` — same-SHA reset, tests and staging migration state;
- `queue-aggregate/` — counts/age and sanitized CLI metadata only;
- `operator-access/` — least-privilege issuance/revocation review;
- `lifecycle-exercise/` — synthetic transitions, idempotency and negative tests;
- `report-and-block-device-tests/` — synthetic-account journey evidence;
- `policy-and-appeal/` — approved versions, owner and publication references;
- `store-declarations/` — approved App Store/Play answers and review metadata.

Never commit report content, snapshots, user identifiers, email addresses,
provider secrets, service-role values or restricted case notes.

## Platform references

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play user-generated content policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
