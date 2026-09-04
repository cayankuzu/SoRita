# SoRita — Accessibility Report

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03
- Scope: the frozen product surface. No screen or control was added or removed.

## Summary

Static accessibility is enforced by a build gate rather than by review, so it
cannot regress silently. Assistive-technology behaviour on real hardware is not
verified on this commit and is the reason this category is not scored at the top
of the range.

## Interactive control inventory

| Control | Occurrences | Accessible name source |
|---|---:|---|
| `InstantPressable` | 70 | wrapper requires a role and a name |
| `Pressable` | 66 | explicit role plus label or readable child text |
| `PrimaryButton` | 37 | label prop, always a string |
| `IconButton` | 34 | label prop is required, since there is no text child |

Thirty-four files declare `accessibilityState`, so disabled, selected, busy and
expanded states are exposed to assistive technology rather than being conveyed
by colour alone. Seven files add an `accessibilityHint` where the outcome of an
action is not obvious from its name.

## Enforced rules

`npm run accessibility:check` walks the JSX of every component and fails the
build when any of the following is violated. The gate is part of `npm run lint`,
so it runs on every pull request.

1. A raw `Pressable` or `TouchableOpacity` must declare `accessibilityRole` or
   `accessible`. Interactive elements cannot ship as untyped views.
2. Every pressable must have an accessible name, from `accessibilityLabel`,
   `accessibilityLabelledBy`, or readable text inside the element.
3. An element may opt out only by explicitly marking itself hidden, which makes
   the decision visible in review instead of implicit.

Two exemptions exist and are narrow: the `InstantPressable` implementation file
itself, which is the wrapper that supplies semantics to its callers, and elements
explicitly marked as hidden from assistive technology.

Current result: pass, with no violations.

## Colour and text legibility

- No raw colour literal may appear in a component. All colour comes from
  `theme/tokens.ts`, which exposes semantic roles rather than hex values. The
  `ui-tokens` gate fails on a raw colour.
- No text token may be smaller than 12 px. The same gate enforces this, so the
  smallest rendered text stays legible when the user scales type.
- The palette is a single light theme. Contrast is fixed at design time rather
  than being recomputed per theme, because there is only one theme.

## Dynamic type

The live OS `fontScale` is exposed through `useAppLayout`. Surfaces that must
change shape under large type read it and switch layout mode rather than
clipping: the auth form through `useAuthLayoutMode`, the profile tabs through
`profileTabsLayout`, and text input through `TextField`.

## Touch targets

Minimum sizes are tokens: 44 for iOS, 48 for Android, with `controlSize.default`
at 44 and `controlSize.large` at 48. Where a control is visually smaller than its
required target, thirteen components widen it with an explicit `hitSlop` instead
of shipping an undersized target.

## Reduce Motion

Read once in `useReduceMotion` and honoured by the five animated surfaces: toast
host, offline indicator, skeleton placeholder, expandable text and the modal
animation type hook. When the setting is on, decorative motion is dropped rather
than shortened.

## Copy quality

All user-facing strings come from the Turkish catalogue in `shared/i18n/tr.ts`.
The `ui-copy` gate fails on raw JSX copy, including accessibility strings, so a
label cannot be hard-coded at a call site and drift from the catalogue. Backend
error text is never surfaced directly; failures are mapped to typed classes and
then to catalogue keys.

## What is not verified on this commit

| Item | Why it is open |
|---|---|
| VoiceOver traversal order and rotor behaviour | Requires a physical iOS device |
| TalkBack traversal order and gesture navigation | Requires a physical Android device |
| Focus movement into and out of modals and sheets | Requires a physical device with a screen reader |
| Measured contrast ratios against rendered pixels | Requires device capture; tokens are fixed but not measured on-device |
| Behaviour at 200% scale on the smallest supported hardware | Requires a physical small-screen device |

The procedures for each are in [MANUAL_STEPS.md](../MANUAL_STEPS.md), and the
results have a machine-checkable receipt shape under the physical device matrix
check in `release-evidence/runtime-receipt.schema.json`.

## Verification commands

| Check | Command | Result |
|---|---|---|
| Pressable semantics and names | `npm run accessibility:check` | pass |
| Token and text-size compliance | `npm run ui-tokens:check` | pass |
| No raw copy in JSX | `npm run ui-copy:check` | pass |
| Component behaviour suite | `npm run test` | 932 tests across 167 files pass |
