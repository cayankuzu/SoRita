# SLO And Observability Plan

## Initial Product SLOs

| SLO | Target |
|---|---|
| API availability | 99.9% monthly |
| Feed p95 latency | < 1.5s server-side |
| Mutation p95 latency | < 2s server-side |
| Upload success | > 98% excluding user cancellation |
| Publish finalization p95 | < 2s after the last media byte reaches storage |
| Crash-free sessions | >= 99.8% |
| Android ANR | below store bad-behavior threshold |
| Touch feedback p95 | < 50ms on the release device matrix |
| Route transition start p95 | < 100ms |
| Warm cached useful content p95 | < 500ms |
| Low-tier Android cold useful content p95 | < 1.5s |
| Fresh content p95 | < 1.5s on the reference 4G profile |
| UI freeze longer than 700ms | 0 in critical flows |

## Required Metrics

- Cold and warm start, time to interactive.
- First shell, cached content, fresh content, and terminal state per screen.
- Navigation intent-to-next-paint p50/p95/p99 by device and network class.
- Feed request p50/p95/p99, payload bytes, page size, cache hit.
- DB slow query, connections, error rate, Realtime disconnects.
- Media-selection-to-first-upload-byte, save-to-publish, upload throughput, prepared-upload reuse,
  failures, retries, orphan cleanup, storage bytes and egress, segmented by network class and media count.
- JS/UI dropped frames, memory pressure, release/device/OS crash rate.
- Push sent/delivered/opened and notification dedupe rate.
- Share opened/cancelled/completed and deep-link cold/warm success.

## Alert Rules

- Critical: auth, feed, upload, or database error budget burn.
- Critical: crash-free sessions below target for a new release.
- Warning: feed p95 or mutation p95 exceeds target for 15 minutes.
- Warning: storage egress or map cost exceeds daily budget.
- Warning: Realtime reconnect failures or notification delivery drop.

## External Evidence Required

- Typed analytics events and Sentry integration are wired in the repository; production provider
  dashboards, retention, alert routing, and burn-rate tests require authorized access.
- The repository includes a 10,000-VU k6 profile covering the current feed, explore, profile-content,
  and notification RPCs with error and p95/p99 thresholds. Execution requires an isolated staging
  dataset and at least 20 authenticated load-test identities.
- Device cold/warm start, FPS, memory, battery, and accessibility evidence must be captured on the
  release device matrix.
