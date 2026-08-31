# Security Checklist

Last updated: 2026-08-30

`[x]` means repository implementation and automated coverage exist. It does not
claim that deployment, provider configuration, staging, or runtime evidence has
been completed. Those external checks remain release gates.

| Status | Area | Current repository state |
| --- | --- | --- |
| `[x]` | Secrets and runtime config | Client-visible Expo values and server-only secrets are separated in `.env.example`. Real service-role, HMAC, email-provider, EAS, Cloudflare, and Sentry secrets must stay in their protected provider environments and must not be committed. |
| `[x]` | Authentication and authorization | Sensitive auth operations use `auth-gateway`; public responses are enumeration-safe, signed requests and access tokens are verified, availability cannot be called directly by anonymous/authenticated roles, and session refresh is single-flight. |
| `[x]` | Rate limiting | High-risk Edge Functions use the atomic database limiter and fail closed when limiter storage is unavailable. The selective Cloudflare gateway adds route/user/IP controls without an in-memory global limiter. |
| `[x]` | Input validation and request integrity | Auth, media, maps, moderation, and deletion handlers enforce bounded schemas, methods, signed request freshness/nonces, body limits, and controlled error contracts. Selective-Cloudflare requests additionally require a timestamped, replay-protected origin HMAC once the reviewed cutover flag is enabled. |
| `[x]` | SQL, RLS, and least privilege | Forward-only migrations harden mass assignment and function grants. Private operational ledgers, including deletion and moderation cases, are hidden from app roles; service-role moderation writes are restricted to an audited transition RPC. |
| `[x]` | CORS and browser origins | Authenticated Edge Functions use exact allowlists. `MODERATION_REPORTS_ALLOWED_ORIGINS` is explicit; wildcard authenticated CORS is not supported. Native requests do not rely on browser CORS as authorization. |
| `[x]` | HTTP security headers | Shared Edge Function responses and the selective Worker attach the repository's security/no-store headers. Authorization is still enforced by JWT, signatures, RLS, and origin checks rather than headers alone. |
| `[x]` | File upload security | Upload bytes go directly to Supabase Storage with short-lived signed upload authorization, generated owner-scoped paths, content/size validation, finalize checks, private read authorization, cancellation, and bounded retry. The Cloudflare Worker never proxies upload bodies. |
| `[x]` | Moderation intake and operations | Existing report flows are authenticated, signed, idempotent, rate-limited, and checked through reporter-scoped RLS before service-role evidence capture. Alert email contains only opaque report/type routing data. Internal case status, SLA metadata, append-only audit events, and confirmed CLI/RPC transitions add admin-panel-free review/close/sanction/appeal operations. |
| `[x]` | Error handling and logging | Client responses are controlled and unexpected moderation failures no longer return raw database/provider messages. Logs use request IDs and bounded error codes; tokens, signed URLs, report snapshots, user details, and precise location must not be logged. |
| `[x]` | Account deletion and private state | Deletion is an idempotent leased saga with reconciliation. Logout/account changes purge owner-scoped query, snapshot, outbox, signed-URL, and media state. |
| `[x]` | Durable upload cleanup source | Upload sessions use a private lease/state ledger, reference gates and repeated cleanup horizons. A protected bounded GitHub sweeper definition and unit guard exist; hosted execution remains an external gate. |
| `[x]` | Supply-chain automation | Release workflows include production dependency audit, license/provenance checks, Semgrep, full-history Gitleaks, pinned critical actions, and same-SHA release evidence. |
| `[~]` | Dependency/runtime findings | Counts must come from the current immutable commit's `npm audit`, Expo Doctor, native build, and signed artifact evidence. This checklist intentionally does not preserve stale vulnerability counts. |
| `[~]` | Deployment and runtime verification | Repository gates are prepared, but Supabase migration/function deployment, Cloudflare protected environments, EAS signing, staging tests, real-device tests, restore drills, canary, and rollback evidence remain external `NO-GO` gates. |

## Automated verification

Run from the repository root:

```powershell
npm run security:verify
npm run security:audit:prod
npm run security:licenses
npm run security:provenance
npm run feature-surface:check
npm run ops:test
```

`security:verify` explicitly includes the `moderation-reports` handler suite as
well as auth, client/origin request-signing, maps, media, deletion, and
private-media coverage.
Database privilege and lifecycle behavior are covered by
`supabase/tests/rls_and_security.sql`,
`supabase/tests/account_deletion_moderation_retention.sql`,
`supabase/tests/cloudflare_origin_security.sql`, and
`supabase/tests/moderation_ops_security.sql` when `supabase test db` runs.

## Manual release gates

- `[ ]` Apply all pending migrations to isolated staging; run migration replay,
  DB lint, both pgTAP suites, and dump/restore against the same commit SHA.
- `[ ]` Deploy `auth-gateway`, `maps-geocoding`, `media-assets`, `moderation-reports`,
  and `delete-user` with exact secrets/origin allowlists from protected storage.
- `[ ]` Prove hosted Supabase Auth rate limits, CAPTCHA/bot controls, email
  confirmation/change behavior, exact redirect allowlist, password/leak policy
  and the recorded MFA decision for direct `/auth/v1` traffic.
- `[ ]` Provision and exercise the protected media-upload sweeper in staging,
  attach retry/reference-safety reconciliation plus alert delivery evidence, and
  then prove scheduled hosted execution on the exact release SHA.
- `[ ]` Exercise reporter-visible, reporter-invisible, blocked, duplicate,
  rate-limited, email-provider-down, and audited moderation case transitions in
  staging without printing report content or credentials.
- `[ ]` Configure an approved moderation SLA policy through the audited
  `set-sla` operation. No SLA duration is assumed by repository code.
- `[ ]` Attach current full-history secret scan, SAST, dependency, signed
  Android/iOS artifact, real-device, Cloudflare/EAS canary/rollback, incident,
  and restore evidence to the immutable release SHA.
- `[ ]` Follow `docs/MANUAL_STEPS.md`; absent external evidence keeps the release
  `NO-GO` even when repository checks pass.
