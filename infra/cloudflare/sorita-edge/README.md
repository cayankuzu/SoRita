# SoRita selective edge gateway

This directory is an independent Cloudflare Worker project for the small set of existing SoRita HTTP boundaries that benefit from an edge security layer. It is not a replacement for Supabase Auth, Postgres/RLS, Realtime, or Storage, and it must not become a proxy for general application traffic or media bytes.

No Cloudflare deployment is performed by this project setup.

## Route contract

All paths are exact. Query strings and trailing slashes are rejected. Browser preflight uses `OPTIONS`; the application methods are otherwise fixed.

| Worker route | Method | Maximum JSON body | Authentication | Forwarded Supabase function |
| --- | --- | ---: | --- | --- |
| `/health` | `GET` | none | none | none |
| `/v1/auth-gateway` | `POST` | 32 KiB | optional only for the explicit public actions below; required for authenticated actions | `auth-gateway` |
| `/v1/maps-geocoding` | `POST` | 4 KiB | required | `maps-geocoding` |
| `/v1/moderation-reports` | `POST` | 8 KiB | required; `reporterUserId` must equal JWT `sub` | `moderation-reports` |
| `/v1/media-assets` | `POST` | 64 KiB | required | `media-assets` |
| `/v1/delete-user` | `POST` | 1 KiB | required | `delete-user` |

The only auth actions allowed without a bearer token are:

- `check-availability` without `excludeUserId`
- `login`
- `register`
- `resend-confirmation`
- `request-password-reset`
- legacy compatibility action `prepare-password-reset`

`check-availability` with `excludeUserId`, `request-password-reset-authenticated`, and `prepare-password-reset-authenticated` require a JWT. Unknown fields are rejected at the Worker boundary.

The media route permits only `create-upload-url`, `complete-upload`, `create-read-url`, `create-read-urls`, and `delete`. Create/complete require a UUID `uploadSessionId`; delete accepts that UUID when it belongs to an upload lifecycle. The `upload` action and every payload containing `fileBase64` are rejected. File bytes go directly from the client to Supabase Storage using the signed upload contract; they never traverse this Worker.

## Security behavior

- Supabase JWTs are verified cryptographically against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Verification requires an allowed asymmetric algorithm, the exact `${SUPABASE_URL}/auth/v1` issuer, configured audience, valid signature, `exp`, `nbf`, and a UUID `sub`.
- JWKS data has a bounded ten-minute fresh TTL and five-minute stale-on-network-error grace. A `kid` miss forces one coalesced refresh; a bounded negative cache and cooldown prevent random-`kid` refresh amplification. Stale keys never bypass signature, issuer, audience, time, or subject validation.
- Deployment gate: the Supabase project must use an asymmetric ES256 or RS256 signing key. Legacy shared-secret tokens are intentionally rejected because they cannot be verified from the public JWKS endpoint.
- The Worker forwards the original user bearer token and the environment's publishable/anon key. There is no service-role binding.
- Every proxied request first consumes a coarse HMAC-hashed `CF-Connecting-IP` key before request-body or JWT/JWKS work. A second action-level check uses the verified user ID when available, otherwise another hashed-IP key. Binding failures return `503` and never reach the origin.
- Cloudflare's Rate Limiting API is deliberately a coarse abuse-control layer. It is per-location and eventually consistent. Exact login lockouts and business quotas remain atomic Supabase/Postgres responsibilities.
- JSON is read as a bounded byte stream even when `Content-Length` is absent. Compressed bodies, non-JSON content, unknown methods, paths, actions, and fields fail closed.
- Every response, including health, errors, preflights, and upstream responses, is `Cache-Control: private, no-store`. Origin cookies and cache headers are never forwarded.
- `/health` returns the immutable 40-character `BUILD_SHA`; preview and canary workflows require it to equal the exact candidate commit.
- Mutations are attempted exactly once. There are no automatic origin retries. Origin timeouts return `504`; origin redirects, malformed responses, and `5xx` bodies are converted to sanitized `502` responses. `429 Retry-After` is retained.
- Browser requests require an exact `Origin` match from `CORS_ALLOWLIST`. Native requests without `Origin` are allowed. CORS is not treated as authentication.
- Logs are structured JSON and contain only request ID, CF Ray ID, environment, route, action, actor class, status, duration, and a stable error code. Tokens, request bodies, email addresses, user IDs, raw IP addresses, secrets, and upstream error bodies are not logged.

### Origin HMAC contract

For each proxied call the Worker adds:

- `X-Sorita-Edge-Timestamp`: Unix time in milliseconds
- `X-Sorita-Edge-Nonce`: cryptographically random UUID
- `X-Sorita-Edge-Body-Sha256`: lowercase hexadecimal SHA-256 of the exact forwarded body
- `X-Sorita-Edge-Signature`: `v1=<base64url HMAC-SHA256>`

The signed message is exactly five newline-delimited fields:

```text
<timestamp>
<nonce>
<UPPERCASE METHOD>
<canonical origin path>
<body SHA-256 hex>
```

For example, the canonical path for the public `/v1/auth-gateway` route is `/functions/v1/auth-gateway`.

The matching `ORIGIN_HMAC_SECRET` must be installed as a Cloudflare Worker secret and as a Supabase project secret. Before direct-origin access is disabled, each selected Supabase function must verify the HMAC in constant time, enforce a short timestamp window, and atomically reject nonce replay. The Worker-generated HMAC is additional server identity; existing client request-signing headers are forwarded only after syntax validation for controlled rollout compatibility.

## Environments and configuration

`wrangler.jsonc` defines `development`, `preview`, and `production` with distinct Worker names, `workers.dev` routes, upstream placeholders, log sample rates, and Rate Limiting namespace IDs. Bindings are repeated because Wrangler bindings and variables are non-inheritable.

Before any deployment:

1. Replace every `.invalid` browser origin and `replace-*-project-ref` Supabase URL with the approved environment-specific values.
2. Allocate Rate Limiting namespace IDs that are unique in the Cloudflare account. Namespace IDs in the checked-in file are reserved placeholders, not globally guaranteed values.
3. For production, configure the approved stable custom API domain/route and decide whether to disable `workers.dev`. Do not guess a production hostname in source control.
4. Configure WAF/body/method/bot protection separately. The Worker binding is the second rate-limit layer, not a WAF replacement.
5. Verify that the origin HMAC validator is deployed in observation mode before enforcing origin bypass protection.

Non-secret configuration stays in `wrangler.jsonc`. Required secret names are declared through Wrangler's `secrets.required`, so type generation and deploy validation have a single source of truth.

Create local values by copying `.dev.vars.example` to `.dev.vars.development`. Never commit `.dev.vars*` or `.env*` files. Install deployed secrets independently for every environment:

```powershell
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --env development
npx wrangler secret put ORIGIN_HMAC_SECRET --env development
npx wrangler secret put IP_HASH_PEPPER --env development
```

Repeat with `preview` and `production`; never reuse the HMAC secret or IP pepper between environments.

## Local verification

Use Node.js 22 or newer from this directory:

```powershell
npm ci
npm run types:check
npm run typecheck
npm run lint
npm test
npm run dry-run:development
npm run dry-run:preview
npm run dry-run:production
```

`npm test` uses the current `@cloudflare/vitest-plugin` and executes in Workerd. The contract suite covers JWT signature/issuer/audience/expiry/nbf, exact routes/methods/body limits/schemas/actions, native and browser CORS, rate-limit denial/failure, no-store behavior, HMAC construction, timeouts, origin `429`/`5xx`, no mutation retry, media-byte rejection, and health-response secrecy.

Run `npm run types` after every `wrangler.jsonc` binding change and commit the regenerated `worker-configuration.d.ts`.

The `dry-run:*` scripts only build and validate locally. This repository intentionally contains no automatic deploy script or deployment credential.
