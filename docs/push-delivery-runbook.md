# SoRita — Push Delivery Operations Runbook

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03
- Audience: on-call operator

This is the operational entry point. It holds the actions an operator takes. The
contract, lifecycle and design details live in the documents indexed below and
are not repeated here.

| Question | Document |
|---|---|
| Which notification types exist and what payload do they carry? | [push-current-contract.md](./push-current-contract.md) |
| How are tokens registered, rotated and revoked? | [push-provider-and-token-lifecycle.md](./push-provider-and-token-lifecycle.md) |
| How do retry, receipt polling and dead-lettering work? | [push-outbox-retry-receipt-dlq.md](./push-outbox-retry-receipt-dlq.md) |
| Which devices and lifecycle states must be tested? | [push-real-device-matrix.md](./push-real-device-matrix.md) |
| Credentials leaked or expired, what now? | [push-incident-and-credential-rotation-runbook.md](./push-incident-and-credential-rotation-runbook.md) |

No new notification type, category or user-facing setting was added. The frozen
surface remains 10 notification types.

## Operator commands

Two commands exist. Both require service-role credentials in the operator's
environment and neither is reachable from the app.

### Check scheduler health

```bash
npm run ops:push-delivery:health
```

Calls the `get_push_delivery_scheduler_health` routine and prints a JSON health
object. It takes no parameters, and passing one is an error rather than being
ignored.

Read the result as follows:

| Signal | Healthy | Action if not |
|---|---|---|
| `healthy` | true | Continue to the specific counters below |
| Backlog age | within the agreed window | If growing, check provider status before touching jobs |
| Dead or stalled count | zero or steady | If rising, triage before requeueing |
| Invalid token rate | low and stable | A spike usually means a credential or environment mismatch, not a job problem |

### Requeue one dead-lettered job

```bash
npm run ops:push-delivery:requeue -- \
  --dead-letter-id <uuid> \
  --requeue-key <uuid> \
  --confirm <confirmation>
```

Three properties matter here and are enforced, not conventional:

- **One job at a time.** There is no bulk requeue, so a mistake cannot re-notify
  a large audience.
- **Both identifiers must be UUIDs.** Malformed input is rejected before any
  database call.
- **An explicit confirmation string is required.** The command refuses to run
  without it, so it cannot fire from a shell history recall.

The requeue key is the idempotency key. Requeueing the same job twice with the
same key does not produce a second notification.

## Triage order

Work down this list. Do not requeue before reaching step 4.

1. **Confirm the blast radius.** Run the health command. A single failing job and
   a systemic outage need different responses.
2. **Check the provider first.** If APNs or FCM is degraded, jobs are failing for
   a reason outside the system. Retries with backoff are already running. Wait.
3. **Separate permanent from transient.** An unregistered token is permanent and
   is cleaned up automatically. A 429 or 5xx is transient and retries. Neither
   needs an operator.
4. **Only then consider a requeue,** and only for jobs that dead-lettered because
   of a fault that has since been fixed.
5. **Never replay old events in bulk.** Re-sending a stale notification is a
   user-visible defect, not a recovery.

## What is safe to do during an incident

| Situation | Safe action | Do not |
|---|---|---|
| Provider returning 5xx | Nothing; backoff is already applied | Requeue, which adds load to a failing provider |
| Backlog growing, provider healthy | Check scheduler health and lease expiry | Restart workers blindly |
| A single job stuck | Requeue that one job with its idempotency key | Bulk requeue |
| Invalid token spike | Compare bundle, package and environment parity against the provider | Delete token rows manually |
| Credentials rotated or leaked | Follow the credential rotation runbook | Rotate in production without preparing the new key first |

## Design guarantees an operator can rely on

These are verified by the pgTAP suite `push_delivery_hardening.sql`, which is one
of the six suites in the Docker profile.

- Job claiming is atomic and leased. Two workers cannot claim one job.
- A crashed worker's lease expires and the job is recoverable rather than lost.
- Delivery is at-least-once. Consumers are idempotent by event key, so a repeat
  delivery does not produce a repeat notification.
- The core mutation commits independently of push delivery. A provider outage
  never rolls back the user's action.
- Permanent failures move to a dead-letter state with an audit trail rather than
  retrying forever.
- Invalid and unregistered tokens are cleaned up automatically.

Push jobs live in PostgreSQL, in the same transactional boundary as the events
that produce them. No Cloudflare Queue was introduced, because doing so would
create a second source of truth for the same work.

## Privacy

Raw tokens are never logged. Payloads carry the minimum needed to route a tap,
not message bodies, email addresses or precise location. Block, privacy and
deletion state is evaluated both when a job is enqueued and again when it is
dispatched, so a block that lands between the two still takes effect.

## What is not verified on this commit

The physical device matrix has no receipts. Push behaviour across foreground,
background and terminated states, permission transitions, token rotation, user
switch, provider 429 and 5xx, and tap routing to blocked or deleted targets all
require real iOS and Android hardware plus live provider credentials.

Until those receipts exist and are bound to this commit, push is not scored at
the top of the range and the release stays NO-GO. The procedure is in
[MANUAL_STEPS.md](./MANUAL_STEPS.md); the receipt shape is the physical device
matrix check in `release-evidence/runtime-receipt.schema.json`.
