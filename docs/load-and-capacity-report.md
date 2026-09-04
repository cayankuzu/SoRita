# SoRita — Load and Capacity Report

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03
- Executed on: local Docker, k6 in the `load` profile

## Read this first

The run below executes against the **deterministic mock upstream**, not against
Supabase or a deployed Worker. Its latency figures measure the test harness and
the local container, so they are **not** a capacity result and must not be quoted
as one.

What the run does prove is the part that does not depend on upstream speed: the
representative flows return the correct contract, and every one of them returns
`no-store` under sustained concurrency. That is a real cache-safety result.

**The 10,000 concurrent user target is not demonstrated on this commit.** No
staged load has been run against isolated staging. Claiming otherwise from a
mock-backed smoke run would be exactly the fabricated benchmark the brief
forbids.

## What was executed

```bash
npm run docker:load:smoke
```

Exit code 0.

| Measure | Value |
|---|---|
| Virtual users | 5 |
| Duration | 10 s |
| Completed iterations | 24,474 |
| Iteration rate | 2,437.67 per second |
| HTTP requests | 122,370 |
| Failed requests | 0, which is 0.00% |
| Interrupted iterations | 0 |

Latency, harness-bound and not a production figure:

| Statistic | Value |
|---|---|
| Average | 933 µs |
| Median | 364 µs |
| p90 | 1.08 ms |
| p95 | 1.64 ms |
| Minimum | 25 µs |
| Maximum | 59.85 ms |

## Contract assertions under load

Five representative flows were exercised. Every one asserted four properties on
every response, and all passed across 122,370 requests:

| Flow | 200 | JSON | `no-store` | Contract shape |
|---|:--:|:--:|:--:|:--:|
| discovery | pass | pass | pass | pass |
| lists | pass | pass | pass | pass |
| social | pass | pass | pass | pass |
| auth-gateway | pass | pass | pass | pass |
| edge | pass | pass | pass | pass |

The `no-store` assertion is the one worth keeping. It means that under sustained
concurrency, no representative flow degraded into a cacheable response. A shared
cache cannot leak one user's discovery, list, social or auth response to another,
because none of them ever became cacheable in the first place.

## Why the mock is the right upstream for this profile

The mock is deterministic and free. Pointing this profile at Google Maps or a
hosted Supabase project would spend quota and money to measure a provider rather
than the code, and it would make the result non-reproducible in CI. The profile's
job is contract and cache verification under concurrency, and it does that.

Capacity measurement is a different job with different requirements, listed next.

## What a real capacity test requires

None of this can run from this environment. It needs an isolated staging project
with representative data, and provider cost approval before the higher stages.

Staged profile, stopping at any stage that breaches its gate:

| Stage | Virtual users | Purpose |
|---|---:|---|
| smoke | 1 | contract sanity |
| baseline | 25 | establish per-endpoint latency |
| moderate | 250 | first pool and lock pressure |
| heavy | 1,000 | connection saturation behaviour |
| target | ramp toward 10,000 | only with explicit cost and quota approval |

Workloads to separate rather than blend: read-heavy discovery, write mutations,
Realtime reconnect storms, push enqueue, upload ticket and finalize, auth abuse,
Worker cache hit and miss, and origin failure.

Metrics to capture at every stage, with raw artifacts retained:

- Latency p50, p95 and p99 per endpoint
- Error rate by class, separating 4xx from 5xx
- Database CPU, IO and connection count
- Connection pool queue depth
- Lock waits, deadlocks and long-running transactions
- Slow query log with `EXPLAIN (ANALYZE, BUFFERS)` for hot paths
- Worker CPU time and subrequest count
- Supabase rate limiting and egress
- Cost estimate for the stage
- Recovery time after the load stops

Two hard rules: never run load against production user data, and stop at the
first stage that breaches its gate rather than pushing to the next.

## Capacity-relevant properties already verified

These come from the Docker profile and hold on a clean database:

| Property | Evidence |
|---|---|
| Cursor pagination with bounded page size | unit tests and `data/constants.ts` |
| RLS policies present and enforced | 180 pgTAP assertions across 6 suites |
| 50 RLS policies survive dump and restore | restore parity check |
| Atomic, leased push job claiming | `push_delivery_hardening.sql` |
| No unbounded retry loops | outbox attempt limits and dead-lettering |
| Worker timeouts and bounded bodies | 34 Worker contract tests |

Query plans on production-scale data are **not** verified. The local database has
no representative row counts, so an `EXPLAIN` here would not predict production
behaviour and none is presented.

## Honest status

| Item | Status |
|---|---|
| Contract and cache safety under local concurrency | VERIFIED |
| Harness throughput | MEASURED, not a capacity figure |
| Per-endpoint production latency | NOT MEASURED |
| Database behaviour under load | NOT MEASURED |
| Worker CPU and subrequest budget | NOT MEASURED |
| 10,000 concurrent users | NOT DEMONSTRATED |
| Cost model at target load | NOT ESTABLISHED |

The scale category is scored accordingly in
[quality/release-scorecard.json](../quality/release-scorecard.json) and is one of
the reasons the release verdict is NO-GO.
