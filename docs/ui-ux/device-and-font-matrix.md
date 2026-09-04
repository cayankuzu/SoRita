# SoRita — Device, Screen and Font Scale Matrix

- Candidate commit: `b8c8dd9bc822d4d66f55befcbde88ecb38704c3c`
- Date: 2026-09-03

## Declared support, as it actually is

These values are read from the shipped configuration, not aspirational.

| Property | Declared value | Consequence |
|---|---|---|
| Interface style | `light` | One theme. There is no dark mode and none was added. |
| Orientation | `default` | The app does not lock orientation. Layout must survive rotation. |
| iOS tablet support | not declared, therefore off | iPhone only. iPad runs in compatibility mode. |
| Android config changes | keyboard, orientation, screen size, screen layout, UI mode, smallest width | Rotation and resize are handled in-process, not by activity restart. |
| Soft input mode | `adjustResize` | The layout shrinks for the keyboard rather than panning. |

Tablet and landscape-optimised layouts are **out of scope** and were not added.
The product declares phone support, and this document records that honestly
rather than claiming a matrix the product does not serve.

## Layout classes implemented in code

Breakpoints live in one place, `shared/utils/layout.ts`, and are consumed through
`useAppLayout`. They are computed from *usable* width, meaning after safe-area
insets, not raw window width.

| Class | Usable width | Where it applies |
|---|---|---|
| `compact` | below 600 | Every supported phone, portrait |
| `medium` | 600 to 839 | Large phone landscape, iPad compatibility |
| `expanded` | 840 and above | Reachable only on tablets in compatibility mode |

| Height class | Usable height |
|---|---|
| `short` | below 560 |
| standard | 560 and above |

A `isSplitLike` flag is set when usable width drops below 360, or when the window
is landscape with usable height below 520. This is the condition that drives the
denser presentation on small and rotated windows.

## Device width classes the layout code covers

| Class | Representative width | Layout class | Covered by |
|---|---|---|---|
| Small iPhone (SE class) | 320 to 375 pt | compact, `isSplitLike` below 360 | `layout.test.ts`, small-screen Maestro flow |
| Standard iPhone | 390 to 393 pt | compact | unit tests and component tests |
| Large iPhone (Pro Max) | 430 pt | compact | unit tests and component tests |
| Small Android | 360 dp | compact, at the `isSplitLike` boundary | `layout.test.ts` |
| Standard Android | 393 to 412 dp | compact | unit tests and component tests |
| Large Android | 480 dp | compact | unit tests and component tests |
| Landscape phone | height below 520 | compact with `isSplitLike` | `layout.test.ts` |

Safe-area handling is applied in 30 components through `useSafeAreaInsets` or
`SafeAreaView`, so notch, punch-hole and gesture-bar insets are subtracted before
any breakpoint decision.

## Font scale

`useAppLayout` returns the live `fontScale` from the OS. Components that must
change shape under large type read it rather than assuming a fixed size.

| Scale | Behaviour | Where enforced |
|---|---|---|
| 100% | Baseline typography from `theme/tokens.ts` | token scale |
| 130% | Text reflows, no truncation of primary labels | `useAuthLayoutMode`, `profileTabsLayout` |
| 160% | Auth form switches to its compact layout mode | `useAuthLayoutMode` |
| 200% | Controls stack rather than clip; map controls keep their minimum touch size | `authLayout`, `GoogleMapView`, `TextField` |

No text token is below 12 px, and the `ui-tokens` guard fails the build if one is
introduced. This keeps the smallest rendered text legible once scaled.

## Touch targets

Minimum sizes are tokens, not per-call-site literals:

| Token | Value | Platform rule satisfied |
|---|---|---|
| `touch.ios` | 44 | iOS minimum 44 by 44 pt |
| `touch.android` | 48 | Android minimum 48 by 48 dp |
| `controlSize.default` | 44 | Default interactive control height |
| `controlSize.large` | 48 | Primary actions |
| `controlSize.compact` | 32 | Only where an explicit `hitSlop` widens the target |

Thirteen components apply an explicit `hitSlop`, which is the mechanism used
wherever the visual control is smaller than the required touch target. The
`accessibility` guard requires a role and a label on every pressable, so an
icon-only control cannot ship unlabelled.

## Reduce Motion

Reduce Motion is read once in `shared/hooks/useReduceMotion.ts` and consumed by
the five surfaces that animate: the toast host, the offline indicator, the
skeleton placeholder, expandable text and the modal animation type hook. When the
OS setting is on, decorative animation is dropped rather than merely shortened.

Motion durations are tokens (`motion.fast` 120 ms, `motion.standard` 180 ms,
`motion.slow` 260 ms) so no screen can introduce a slow bespoke animation.

## What is verified automatically, and what is not

| Aspect | Status | Evidence |
|---|---|---|
| Breakpoint arithmetic across width and height classes | AUTOMATED | `layout.test.ts` |
| Token compliance, no raw colors, no sub-12px text | AUTOMATED | `npm run ui-tokens:check` |
| Every pressable has role and label | AUTOMATED | `npm run accessibility:check` |
| Component behaviour under layout modes | AUTOMATED | component tests in the 503-test suite |
| Rendered pixels on real hardware at each width and font scale | NOT VERIFIED | requires physical devices, see MANUAL_STEPS |
| VoiceOver and TalkBack traversal order | NOT VERIFIED | requires physical devices |

The unverified rows are the honest reason the multi-device and accessibility
categories cannot be scored at the top of the range on this commit.
