# SoRita Release Readiness

Last verified: 2026-07-18, `main` based on `89d9bc89835d55e3fd8415e0225a21213bd05692`.

## Repository gates

Run the full local release gate with:

```bash
npm ci --ignore-scripts
npm run check:release
```

`check:release` includes Expo compatibility/Doctor, zero-warning lint, architecture and UI-copy
guards, app/test TypeScript, production dead-code/dependency checks, 30 critical-flow evidence,
production audit, license and package provenance, unit/integration/security tests, and 90% global
coverage thresholds.

Current local result: PASS. Detailed counts and measurements are recorded in
`docs/release/FINAL_RELEASE_EVIDENCE.md`.

## Database and backend gate

GitHub Actions starts an isolated Supabase stack and must pass:

1. Replay every forward-only migration from a reset database.
2. `supabase db lint --local --level error`.
3. `supabase test db`, including anon/user-A/user-B/service-role RLS and IDOR cases.
4. Custom read-model, private-media authorization, account-deletion, index, and function checks.
5. `pg_dump` and `pg_restore` into a separate database with `--exit-on-error`.

After CI passes, an authorized operator must deploy to staging, verify drift and representative SQL
plans, run the load profile, and only then deploy the same forward-only migrations/functions to
production. Never reset production or rewrite migration history.

## Device and store gate

The following cannot be inferred from unit tests and must have retained iOS and Android evidence:

- All 30 flows in cold, warm, foreground, background, offline, and recovery states.
- Small/large screens, light/dark theme, Dynamic Type 200%, VoiceOver, TalkBack, switch control,
  contrast, clipping, keyboard, and reduced-motion behavior.
- Cold/warm start, useful-content latency, scroll/swipe FPS, dropped frames, memory, battery, map,
  media prefetch/playback, and background/interrupted upload behavior.
- Push and deep-link routing from foreground/background/terminated states.
- Signed internal builds using existing credentials, TestFlight/Internal Track smoke, store privacy
  declarations, staged rollout, rollback, and SLO monitoring.

## Production decision

Repository automatic gates: **PASS**.

Production release: **NO-GO** until database CI/staging, authorized load, provider dashboards,
physical devices, signed internal builds, store checks, and rollout/rollback gates pass.
