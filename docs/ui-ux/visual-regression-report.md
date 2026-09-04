# SoRita — Visual Regression Report

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03

## Honest status

**There is no pixel-diff visual regression harness in this repository, and none
was added.** Screenshot comparison requires a rendered device or simulator, which
is not available in this environment, and a fabricated baseline would be worse
than no baseline. This document records the mechanisms that do prevent visual
drift today, and states plainly what they cannot catch.

Because the pixel evidence is absent, the UI category is not scored at the top of
the range on this commit.

## What actually prevents visual drift today

### 1. Token enforcement, which is a build gate

`npm run ui-tokens:check` fails the build when a component introduces a raw
colour literal or text below 12 px. Every colour, spacing, radius, shadow, icon
size, opacity and motion duration comes from `shared/theme/tokens.ts`, which is
a single 242-line file exposing 14 token groups.

This is the strongest of the three mechanisms, because it makes the most common
cause of visual drift, a one-off hex value or a bespoke spacing number, fail
before it can be merged. It is a static guarantee, not a sampled one.

### 2. The UI catalogue as a live fixture

`UiCatalogScreen` is an existing developer surface that renders shared components
in their real states on a real device: empty state, inline notice, skeleton
placeholder, primary button, text field and the confirm-action modal. It is the
fixture a human or a future harness would capture, and it already exists inside
the frozen surface, so no new screen is needed to enable screenshot capture
later.

Its coverage is partial. It renders 6 of the 16 components in
`shared/components/ui`. Widening it is a reasonable future step, but it was not
done here because it would change a screen's content for reporting convenience
rather than to fix a defect.

### 3. Device flows that exercise layout

Three Maestro flows exist and run against a real device or emulator:

| Flow | What it covers |
|---|---|
| `auth-guest.yaml` | The unauthenticated entry path |
| `auth-keyboard-small.yaml` | Auth layout with the keyboard open on a small screen |
| `ui-catalog.yaml` | The shared component catalogue |

The small-screen keyboard flow is the one that most directly protects layout,
because keyboard plus small viewport is where clipping appears first.

## What these mechanisms cannot catch

| Failure mode | Caught? | Why |
|---|---|---|
| A raw hex colour is introduced | Yes | token gate |
| Text below 12 px | Yes | token gate |
| A token's own value is changed, shifting every screen | No | the gate checks that tokens are used, not that they are unchanged |
| A component is laid out incorrectly while using correct tokens | No | requires rendering |
| Text clipping at 200% font scale | Partly | layout logic is unit-tested, rendered result is not |
| Overlap after a safe-area change | No | requires rendering on hardware with that inset |
| Icon or baseline misalignment | No | requires rendering |

The third row is worth stating clearly: because tokens are centralised, a single
token edit changes every screen at once. That is the intended benefit for
consistency, and it is also the largest unguarded visual risk, since no test
asserts the token values themselves.

## Reproducing a baseline when a device is available

The steps below are executable and produce artifacts bound to this commit. They
are listed here rather than in a script because none of them can run without
attached hardware.

1. Record the candidate commit, then install the matching build on the device.
2. Run `npm run e2e:device:dev-catalog` to drive the catalogue surface.
3. Run `npm run e2e:device:small` for the small-screen keyboard layout.
4. Capture each surface at 100%, 130%, 160% and 200% font scale, at the width
   classes listed in [device-and-font-matrix.md](./device-and-font-matrix.md).
5. Capture the offline, loading, empty and error states, which are reachable from
   the catalogue without a network.
6. Store captures under a `raw/` path and record them as scenario artifacts in a
   runtime receipt, so byte counts and checksums bind them to this commit.

The receipt shape is defined by the physical device matrix check in
`release-evidence/runtime-receipt.schema.json`.

## Verification run on this commit

| Check | Command | Result |
|---|---|---|
| Token compliance | `npm run ui-tokens:check` | pass |
| Copy centralisation | `npm run ui-copy:check` | pass |
| Pressable semantics | `npm run accessibility:check` | pass |
| Layout arithmetic | included in `npm run test` | pass |
| Pixel comparison | not available | NO EVIDENCE |
