# Backup and Restore Runbook

> Status: hosted backup/PITR entitlement, schedules, restore permissions and a
> successful staging restore are `UNVERIFIED` as of 2026-08-30. An approved RPO
> and RTO do not exist in repository evidence; both are `UNDEFINED` and
> `UNMEASURED`. Production release remains `NO-GO` until the required external
> evidence and owner approvals exist.

Operational owner: `OWNER_TBD`. This runbook does not authorize an in-place
production restore or any destructive database command.

## What a database backup does and does not cover

Supabase database backups protect PostgreSQL data and database-resident
metadata. They do **not** back up the underlying Storage objects. Restoring a
database can restore Storage metadata while leaving deleted or changed objects
unrestored. A project clone or database-only restore also does not by itself
recreate all Edge Functions, secrets, API keys, Auth settings, Realtime
settings, extensions or provider-side configuration.

The recovery inventory must therefore treat these as separate scopes:

| Scope | Required recovery source | Current evidence |
| --- | --- | --- |
| PostgreSQL schema, roles and rows | Supabase managed backup/PITR and/or encrypted logical backup | Hosted state `UNVERIFIED`; local CI drill exists |
| Storage objects | Separate versioned/exported object inventory and recovery procedure | `UNVERIFIED` |
| Storage metadata and policies | Database backup plus migrations/policy source | Source present; hosted restore `UNVERIFIED` |
| Edge Functions | Repository source plus controlled deployment | Source present; deployed parity `UNVERIFIED` |
| Function secrets | Approved secret manager/provider configuration | Values intentionally absent from repository; recovery `UNVERIFIED` |
| Auth/Realtime/extensions/project settings | Provider inventory and reviewed configuration record | `UNVERIFIED` |
| Mobile/edge configuration | Repository plus EAS/Cloudflare environment records | External parity `UNVERIFIED` |

## Policy gates

Before relying on backup/restore for production, an authorized owner must:

1. approve RPO and RTO based on business impact (`OWNER_TBD`);
2. verify the Supabase plan and managed-backup/PITR retention in the provider;
3. assign separate owners for database, Storage, secrets and application
   validation;
4. complete a restore into a new isolated staging project;
5. document downtime and data-loss expectations for an in-place restore;
6. approve encryption, access, retention and deletion rules for exported
   artifacts.

Until all six are evidenced, the backup/restore production gate is `NO-GO`.

## Local CI recovery drill

The repository database workflow starts local Supabase, resets migrations,
lints and tests the database, creates a logical dump and restores it into an
isolated local database. The authoritative implementation is
`.github/workflows/database-validation.yml`.

Equivalent repository checks:

```powershell
supabase start
supabase db reset --local
supabase db lint --local --level error
supabase test db --local
```

Expected safe result: migrations apply from zero, database lint and tests pass,
and the workflow's isolated dump/restore step completes. This proves only the
local schema/data drill; it does not prove hosted backup availability, Storage
recovery, PITR, secrets or production RPO/RTO.

## Hosted backup inventory

Follow the provider procedure in [`docs/MANUAL_STEPS.md`](./MANUAL_STEPS.md).
Capture only sanitized metadata:

- project/environment identity without credentials;
- backup type, schedule, oldest/newest available restore points and entitlement;
- the roles permitted to restore and the provider audit-log reference;
- database size and Storage-object inventory as aggregates;
- extension, Auth, Realtime, Edge Function and secret **names** required for
  reconstruction;
- approved RPO/RTO decision and owner.

Evidence path: `artifacts/release-evidence/manual/backup-restore/inventory/`.

## Logical backup handling

If an approved recovery design requires a logical backup, use the official
Supabase backup/restore procedure and a dedicated, access-controlled
environment. Supply connection information through an approved secret manager;
never echo it, place it in command history, commit it, or attach it to evidence.

The backup set must be internally consistent and include the reviewed roles,
schema and data components. Encrypt it at rest and in transit, record checksums
and creation time, and test it only in a new isolated project. A backup file
that has not been restored successfully is `UNVERIFIED`.

Never run `supabase db reset --linked`. Do not restore directly over production
as the first test.

## Restore drill: isolated staging first

1. Open an incident/change record and record the source restore point, target
   isolated project and accountable owner (`OWNER_TBD`).
2. Confirm the target is not production and has no production traffic. Capture
   its project reference without exposing credentials.
3. Restore the managed snapshot or reviewed logical backup into that target
   according to the current Supabase procedure.
4. Reapply repository-managed Edge Functions and provider configuration through
   the approved deployment process. Restore secret **names and values** only
   from the secret manager; evidence must contain names/status only.
5. Restore Storage objects through the separately approved object-recovery
   process. Reconcile object counts/metadata with aggregates; do not expose
   object contents in evidence.
6. Verify migration history, schema, extensions, RLS, Auth behavior, signed URL
   access, private/public bucket behavior, Edge Functions and Realtime behavior.
7. Run the database and release checks against the isolated environment where
   safe. Use synthetic accounts and non-sensitive fixtures.
8. Record elapsed recovery time and the restore point actually achieved. These
   observations inform an RPO/RTO decision but do not themselves establish an
   approved SLO.
9. Tear down or quarantine the restored environment according to the approved
   retention policy.

Expected safe result: the isolated target passes the approved functional,
security and data-integrity checklist without receiving production traffic.
Evidence path: `artifacts/release-evidence/manual/backup-restore/staging-drill/`.

## Production recovery

An in-place managed restore or PITR may cause downtime and can replace current
database state. It requires explicit incident-commander approval, a selected
restore point, a communication plan, a current backup, and confirmation that
Storage-object recovery is handled separately. Owner: `OWNER_TBD`.

Minimum sequence:

1. stop or constrain writes using the approved incident mechanism;
2. preserve current audit and recovery evidence;
3. confirm the restore point and expected data-loss window;
4. execute only the provider-approved restore procedure;
5. revalidate project settings, extensions, secrets, functions and Storage;
6. run smoke, RLS, Auth, upload/download and critical-journey checks;
7. resume traffic gradually and monitor the provisional SLIs;
8. document actual downtime, data loss and follow-up repairs.

If validation fails, keep traffic constrained and escalate. The fallback is the
last verified restore point or a clean isolated recovery target selected by the
incident commander; there is no universal automatic rollback for a destructive
database restore.

## Evidence and sign-off

Store sanitized evidence under
`artifacts/release-evidence/manual/backup-restore/`:

- `inventory/` — plan, backup/PITR and configuration inventory;
- `staging-drill/` — commands, provider operation IDs, checksums and test results;
- `storage-drill/` — object inventory, access tests and reconciliation;
- `rpo-rto-approval.md` — proposed/observed/approved values and owner;
- `sign-off.md` — scope, unresolved gaps, rollback and release decision.

Never store database URLs, passwords, service-role keys, secret values,
personal data or restored production rows in these artifacts.

## Provider references

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase backup and restore with the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
