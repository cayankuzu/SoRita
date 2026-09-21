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

## Android device measurement — 2026-09-22

The first on-hardware accessibility evidence for this app. It closes finding A3
in [the design-system audit](../audit/ui-ux-design-system-audit.md) for Android
and, more usefully, it found a defect class the static gate could not see.

| Fact | Value |
|---|---|
| Device | Redmi Note 9 Pro (`joyeuse`), Android 10, API 29 |
| Display | 1080×2400, density 440 (≈393dp wide) |
| Build under test | Play-installed 1.0.108, versionCode 114, installer `com.android.vending`, runtime 1.0.108 |

**Method.** `uiautomator dump` returns the accessibility node tree — the exact
structure TalkBack traverses, with each node's announced name, click actions and
painted bounds. Reading it is stricter than reading the screen: a node that
announces nothing shows up as empty, not as an icon a reviewer can interpret. The
probe refuses to run unless `mCurrentFocus` is SoRita, because the handset is a
personal device.

**A measurement trap, recorded so the next run does not fall into it.** On MIUI,
`uiautomator`'s `Display.getSize()` throws (`theme_compatibility.xml` is absent),
and the dump is then clipped to a 2168px-tall window instead of 2400. Every node
below that line is truncated to the boundary, which reported the bottom tab bar
as 16.4dp tall and produced four convincing false defects. Landmarks in the upper
screen matched the screenshot to the pixel, which is what exposed the clip.
Re-measuring with the display temporarily shortened returned the tab targets at
their true **48dp**, and the display was restored afterwards. Treat any node that
ends exactly at the root boundary as unmeasured, not as small.

### Results

| Screen | Interactive nodes | Unnamed | Undersized after correction |
|---|---:|---:|---|
| Ana Sayfa (feed) | 16 | 0 | none |
| Harita | 40 | 0 | 3 app controls (below) |
| Keşfet | 0 | 0 | none reachable in the captured state |
| Profil | 15 | 0 | none |

**Every interactive node announced itself.** Across all four tabs there was not
one unnamed control, which is the property a screen reader depends on most, and
it is the strongest result in this report. Names are also informative rather than
generic: `"Liste: Deneme. 6 mekân. Açık"`, `"Pin filtresi: Tümü"`,
`"Takipçiler: 5 sonuç"`.

Two feed nodes measure under 48dp and are **not** defects: the place-title button
is 42.2dp painted but carries `hitSlop={6}`, giving 54.2dp effective, and the
expandable review text is a block of text, which WCAG 2.5.5 exempts and which
also has a separate ≥48dp control. Map markers (22.2×30.2dp) are drawn by the
Google Maps SDK, not by this app.

### The defect this found

Three map controls — refresh, pin filter and locate-me — were painted 44×44dp
with no `hitSlop`: 44dp effective against Android's 48dp floor. They had passed
every build, and the reason matters more than the controls:

> `check-touch-targets` parsed only the file in front of it. `MapScreen.tsx`
> imports its sheet from `mapScreenStyles.ts`, so the guard resolved **no**
> declared size, counted the controls as unmeasurable, and skipped them. The
> comment at the top of that guard promises unmeasured controls are "counted as
> unmeasured rather than quietly passing" — for cross-file sheets it was the
> quiet pass.

The guard now follows any import that binds `styles` and merges that module's
sheet, with a local sheet shadowing an imported one. Re-run across the app it
found **25 undersized controls in 9 files**, none of which any previous gate had
reported:

| Area | Controls |
|---|---|
| Auth (login, register, forgot password) | 4 footer links at 44dp |
| Map screen and place editor | 11 controls at 30–46dp |
| Comment panel | 5 controls at 26–44dp |
| Explore header, list editor | 5 controls at 26–44dp |

All 25 are closed with `hitSlop={hitSlopFor(paintedSize)}`, the repository's
sanctioned helper, so **no visual design changed** — only the invisible touch
area grew to 48dp. Six tests cover the new resolution, including the shadowing
rule and the regression itself. The guard now measures 156 files, up from 150.

## What is not verified on this commit

| Item | Why it is open |
|---|---|
| VoiceOver traversal order and rotor behaviour | Requires a physical iOS device |
| TalkBack gesture navigation and announcement order | The node tree is measured above; gesture-driven traversal order is not |
| Focus movement into and out of modals and sheets | Not captured; the probe reads one screen at a time |
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
