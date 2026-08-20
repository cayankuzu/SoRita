# SoRita UI/UX, Performance, KISS and Stability Hardening Report

Date: 2026-08-17  
Decision: **NO-GO** under the master prompt's strict 9.8 definition of done.

The code-change, automated-regression, Android guest-flow, responsive-emulator and static-accessibility work is complete. The release cannot honestly receive a 9.8 score until authenticated A/B/C accounts, destructive sandbox accounts, physical Android/iOS devices, TalkBack and VoiceOver are available.

The repository already contained a large dirty worktree. Existing unrelated changes were preserved; no reset or broad cleanup was performed.

## 1. Final scorecard

The source audit did not include a recorded numeric baseline, so a numeric "before" score would be fabricated. "Before" is therefore retained as the audit's FAIL state.

| Category | Before | Evidence-limited after | Gate |
| --- | ---: | ---: | --- |
| UI/UX | FAIL / no numeric baseline | 9.2 | FAIL: authenticated screens not visually exercised |
| Responsive | FAIL / no numeric baseline | 9.3 | FAIL: iOS and authenticated device matrix missing |
| Accessibility | FAIL / no numeric baseline | 8.7 | FAIL: no TalkBack/VoiceOver run |
| Performance | FAIL / no numeric baseline | 8.8 | FAIL: no physical-device benchmark or 1,000+ account |
| KISS | FAIL / no numeric baseline | 9.6 | FAIL under strict 9.8 threshold |
| Architecture | FAIL / no numeric baseline | 9.7 | FAIL under strict 9.8 threshold |
| Reliability / Stability | FAIL / no numeric baseline | 9.1 | FAIL: authenticated and push E2E missing |
| Code quality | FAIL / no numeric baseline | 9.7 | FAIL under strict 9.8 threshold |
| Overall product quality | FAIL / no numeric baseline | 9.1 | **NO-GO** |

These are evidence ceilings, not claims that the untested paths contain defects.

## 2. Implemented UI fixes

| Screen/component | Problem | Implemented fix | Verification |
| --- | --- | --- | --- |
| Profile tabs / `ProfileContentPager` | All cards mounted; unstable content-height pager | Real virtualized grids, stable tab containers, preserved anchors | Unit/component tests; source-health and bundle pass |
| Profile mini maps | Multiple interactive native maps could mount together | Simple single-active-map interaction coordinator | Mini-map tests pass |
| Feed / `PlaceCard` | Excessive equal-weight content and actions | Media-first hierarchy, primary actions kept visible, secondary actions moved to overflow | Place-card and feed-action tests pass |
| Explore | Rich cards at unusable widths; rotation jump risk | Available-width column calculation, compact media-first 3+ column tiles, anchor recovery | Explore/discovery tests pass |
| Auth | Small-screen/logo/keyboard clipping and fixed composition | Compact/regular composition; focused password field scroll recovery; brand hidden only while compact keyboard is open | 360x640 keyboard Maestro PASS; 200% font and landscape PASS |
| Map | Independently positioned overlays and competing panels | Shared viewport geometry, priority notice stack, exclusive filter/results presentation | Map utility/state tests and UI catalog PASS |
| Place preview | `ScrollView` mounted all cards | Virtualized `FlatList` preview | Tests and source-health pass |
| Comments | Nested/all-at-once comment rendering | Flattened visible tree plus virtualized list and paged replies | Comment tests pass |
| List detail | Wrong semantics and unreliable deep-link target | Correct labels, controlled target pagination, measured recovery flow | List-detail tests pass |
| List editor | Large modal/god component and duplicate internal concerns | Form and styles split into focused modules; dirty-state protection retained | Lint, typecheck, source-health pass |
| Notifications | Tap waited for mark-read; malformed targets; mutation races | Immediate target routing, optimistic/background read, lock-protected accept/reject, pure target contract | Notification tests pass |
| Settings | Stale async responses and repeated large hook concerns | Operation locks/sequence guards; view/media actions extracted without new provider | Settings tests and source-health pass |
| Global modal system | Modal container grouped descendants for screen readers | Removed accessibility grouping, required modal label, announcement/focus restoration, modal boundary semantics | Modal scaffold test and accessibility guard pass |
| Headers | Repeated geometry and asymmetric action slots | Shared `StackScreenHeader` with balanced slots | Lint/typecheck and screen tests pass |
| Buttons/chips | Small hit areas and inconsistent disabled semantics | 44 pt iOS / 48 dp Android targets, labels/roles/states, shared controls | Static accessibility guard PASS |
| Images/loading | Direct image behavior and mismatched placeholders | Shared image lifecycle, fallback/cache behavior and matching skeletons | Image/skeleton tests pass |
| Feedback stack | Toast/banner/offline/upload collisions | Explicit priority and shared rails/insets | Feedback and network tests pass |

## 3. Performance fixes and measurements

| Bottleneck | Fix | Measurement |
| --- | --- | --- |
| Profile/discovery long content | Virtualized `FlatList` grids, stable keys, tuned batch/window behavior | Automated performance tests 24/24 PASS |
| Unlimited mini maps | Single active interactive mini map; others passive | Mini-map tests PASS |
| Place preview/comments | Virtualized/paged rendering | Test suite PASS |
| Location cards limited to first 100 client lists | Server-side location cursor RPC, repository and infinite-query hook | Repository/hook tests PASS; migration deployment not verified |
| Duplicate requests/mutations | In-flight locks, optimistic updates, stale-response guards | Race-path tests PASS |
| Android JS bundle | Export and size budget | 3,949 modules; 8.85 MiB / 12 MiB PASS |
| Coverage runner instability | Deterministic thread pool and scoped coverage temp lifecycle | 149 files / 782 tests; all coverage thresholds PASS |

Coverage:

- Statements: 94.70%
- Branches: 90.13%
- Functions: 94.03%
- Lines: 94.91%

The Android emulator `gfxinfo` sample reported 86.59% janky frames, but this is **not accepted as a product KPI**: it came from a headless emulator while Maestro accessibility scanning was active. The repository's physical-device benchmark command correctly rejected the emulator.

## 4. KISS refactors

| Old complexity | Simplified model | Benefit |
| --- | --- | --- |
| Multiple boolean `PlaceCard` overlays | One discriminated overlay state | Impossible overlapping modal combinations |
| Oversized list editor | `ListEditorModal` + focused `ListEditorForm` + style module | Smaller responsibility and function budgets |
| Oversized map screen | Extracted filter menu and style module | Main render path below source-health budget |
| Large settings hook | Focused view/media action hook | Smaller main state hook without a new provider |
| Inline comment liker modal and mention traversal | Focused component and pure helper | Reduced main component size |
| Notification entity owned by repository | Data contract independent of infrastructure | Architecture boundary restored |
| Repeated headers | One narrow shared header | Consistent geometry without a manager/framework |
| Dead compact place card and unused marker context | Removed | Less API surface and branching |

Source-health result: 384 source files, no dependency cycles, all file/function budgets respected. Dead-code check passed.

## 5. Responsive results

| Scenario | Result |
| --- | --- |
| Android 360x640 auth + keyboard | PASS after password-field recovery fix |
| Android 200% font | PASS for guest auth flow |
| Android landscape | PASS for guest auth flow |
| Android tablet override, about 800 dp width | UI catalog and modal PASS |
| Normal Android phone, 1080x2400 / 420 dpi | Guest auth and UI catalog PASS |
| iPhone small/modern | NOT RUN |
| Authenticated content at 320/360/390/411/480 and 100/130/150/200% | NOT FULLY RUN; layout logic/tests pass, device proof missing |

## 6. Accessibility

Implemented:

- Required labels, roles and disabled/checked/expanded states.
- Modal boundaries and non-grouped descendants.
- Focus restoration and modal announcements.
- Accessible icon buttons and platform minimum hit targets.
- Live-region transient notices.
- Form and report-field labels.
- A stricter pressable accessibility guard.

Validation:

- Static pressable accessibility guard: PASS.
- Android accessibility UI tree on guest auth: separate labels/roles/states confirmed.
- TalkBack: NOT RUN; package unavailable on the AVD.
- VoiceOver: NOT RUN; no macOS/iPhone environment.

## 7. Screen-by-screen evidence matrix

`AUTO` means automated normal/loading/empty/error/offline logic coverage. It is not a substitute for physical-device or screen-reader proof.

| Screen | AUTO states | Android guest/UI catalog | Small/font/rotation | TalkBack/VoiceOver | Authenticated E2E | Final |
| --- | --- | --- | --- | --- | --- | --- |
| Auth landing/login | PASS | PASS | PASS | NOT RUN | NOT RUN | FAIL |
| Registration UI | PASS | UI PASS | PASS | NOT RUN | NOT RUN | FAIL |
| Password reset UI | PASS | UI PASS | PASS | NOT RUN | NOT RUN | FAIL |
| Auth callback/deep link | PASS | NOT RUN | Logic PASS | NOT RUN | NOT RUN | FAIL |
| Home/feed | PASS | NOT RUN | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| Explore lists/places/users | PASS/PARTIAL RLS | NOT RUN | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| Map | PASS | Catalog only | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| Location cards | PASS | NOT RUN | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| Own profile | PASS | NOT RUN | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| User profile | PASS/PARTIAL RLS | NOT RUN | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| List detail/editor | PASS | Catalog only | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| Notifications | PASS | NOT RUN | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| Settings/profile edit/privacy | PASS | Catalog only | Layout tests PASS | NOT RUN | NOT RUN | FAIL |
| UI catalog/modals | PASS | PASS | PASS | Tree only | N/A | FAIL: real screen reader missing |

## 8. Critical E2E results

All 30 flows have named automated evidence. Only the anonymous cold-start guest flow has complete device evidence in the available environment. Under the master prompt's real-E2E definition, the remaining flows are FAIL/BLOCKED rather than being promoted from unit/integration tests.

| ID | Flow | Automated evidence | Real E2E |
| ---: | --- | --- | --- |
| 1 | Anonymous cold start | PASS | **PASS — Android emulator** |
| 2 | Authenticated cold start | PASS | FAIL — Account A/C absent |
| 3 | Sign in | PASS; guest UI exercised | FAIL — no real authenticated session |
| 4 | Registration | PASS; guest UI exercised | FAIL — no disposable account |
| 5 | Password reset and deep link | PASS | FAIL — real mail/deep link not run |
| 6 | Logout and account deletion | PASS | FAIL — destructive sandbox absent |
| 7 | Home feed initial load | PASS | FAIL — authenticated device run absent |
| 8 | Feed infinite scrolling | PASS | FAIL — high-data Account C absent |
| 9 | Like, save and follow | PASS | FAIL — Accounts A/B absent |
| 10 | Menu URL | PASS | FAIL — authenticated device run absent |
| 11 | Open comments | PASS | FAIL — authenticated device run absent |
| 12 | Comment replies and likes | PASS | FAIL — multi-user accounts absent |
| 13 | Notifications screen | PASS | FAIL — authenticated device run absent |
| 14 | Push notification routing | PASS | FAIL — physical push device/account absent |
| 15 | Explore lists | PASS | FAIL — authenticated device run absent |
| 16 | Explore places | PASS | FAIL — authenticated device run absent |
| 17 | Explore users | Evidence mapped | FAIL — live RLS suite/backend not run |
| 18 | Own profile | PASS | FAIL — authenticated device run absent |
| 19 | User profile | App logic PASS | FAIL — multi-user/RLS device path absent |
| 20 | Profile paging and pagination | PASS | FAIL — high-data Account C absent |
| 21 | Followers and following | PASS | FAIL — Accounts A/B absent |
| 22 | List creation and editing | PASS | FAIL — destructive sandbox absent |
| 23 | List detail | PASS | FAIL — authenticated device run absent |
| 24 | Text-based place creation | PASS | FAIL — destructive sandbox absent |
| 25 | Photo upload | PASS | FAIL — physical media/permissions absent |
| 26 | Video upload | PASS | FAIL — physical camera/media absent |
| 27 | Media ordering and deletion | PASS | FAIL — destructive sandbox absent |
| 28 | Private media viewing | PASS | FAIL — Account B absent |
| 29 | Map and location | PASS | FAIL — physical location device absent |
| 30 | Share, report, block and offline | PASS | FAIL — multi-user/device matrix absent |

## 9. Physical-device benchmark

### Android

- Physical low/mid device: NOT RUN.
- Physical current/high-end device: NOT RUN.
- Emulator functional checks: guest auth, UI catalog, 360x640 keyboard, 200% font, landscape and tablet PASS.
- PID-filtered logcat: zero `F AndroidRuntime`, `E ReactNativeJS` or ANR matches after exercised flows.
- Cold/warm start, transition p75, RAM, image memory, JS/UI frame metrics: NOT VALIDATED on physical hardware.

### iOS

- Small iPhone: NOT RUN.
- Modern iPhone: NOT RUN.
- VoiceOver and physical performance metrics: NOT RUN.

The targets for crash-free sessions, ANR-free sessions, warm-start p75, transition p75, dropped frames and stable 1,000+ profile memory therefore remain unproven.

## 10. Regression and release gates

- `npm run check`: PASS — 149 files / 782 tests.
- `npm run test:coverage`: PASS — all 90% global thresholds.
- `npm run expo:check`: PASS — 19/19.
- `npm run dead-code:check`: PASS.
- `npm run performance:test`: PASS — 24/24.
- `npm run security:verify`: PASS — 75/75.
- Production licenses: PASS — 737 packages.
- Registry provenance: PASS — 967 signatures, 212 attestations.
- Android bundle budget: PASS — 8.85 MiB / 12 MiB.
- Critical-flow manifest: PASS — 30/30 mapped, but only 1/12 device-required flows currently has Maestro evidence.
- Production audit policy: PASS, with 2 documented temporary build-only advisories represented by 10 high transitive findings. This is accepted risk, not zero risk.

## 11. Remaining release blockers

These require external environment or test data rather than another local code-only edit:

1. Provide seeded Account A (public), Account B (private), and Account C (1,000+ content, lists, notifications, comments and followers).
2. Provide disposable accounts/sandbox for delete, block, follow, permission reset, recovery and media/list deletion.
3. Provide physical Android low/mid and high-end devices, plus small and modern iPhones.
4. Run TalkBack and VoiceOver with focus order, modal focus, announcements, errors and forms.
5. Deploy and verify the location-card cursor migration against the target Supabase project, then run the live RLS/security SQL suite.
6. Run real push, deep-link, mail recovery, camera/gallery permission and offline/reconnect flows.

No known local lint, type, architecture, KISS, test, coverage, security-test, Expo or bundle-budget failure remains. Unknown defects can still exist behind the unexecuted external flows, so release remains **NO-GO**.
