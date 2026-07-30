# Family Wallet — UX/UI full-scan

Audit date: 2026-07-29
Scope: `fe/apps/web` presentation only. API clients, backend contracts, query/mutation
semantics, redirects, guards, policy rules, fees, thresholds, and state-machine
transitions are explicitly out of scope.

## Executive result

- The router contains 54 rendered route screens, two pathless shells, and one
  redirect-only route. Root error and not-found views add two global UI surfaces:
  **56 surfaces require visual coverage**.
- The existing visual suite covers 41 product routes. It does not fully cover
  auth, admin, `/settings`, `/protecting`, `/guardian/approve-intent`, root error,
  or not-found surfaces.
- Product screens already have a promising warm-paper identity. The experience is
  fragmented by a second token layer, photographic people assets, a generic auth
  and admin shell, and the absence of persistent signed-in navigation.
- The required work can stay entirely in the presentation layer. No endpoint,
  payload, query key, mutation, guard, redirect, or workflow transition needs to
  change.

## Inventory

`/` is a redirect and is not counted as a rendered screen.
`/_authenticated` and `/_authenticated/_admin` are pathless route shells and are
not counted as screens.

| # | Route | Purpose / primary audience | Current UX/UI finding | Planned presentation change |
|---:|---|---|---|---|
| 1 | `/welcome` | Product introduction / new family | Photographic banker dominates; desktop composition is sparse | Original family illustration, clearer promise, stronger responsive hero |
| 2 | `/get-started` | Entry choice / new or returning family | Choice is clear but lacks continuity with signed-in areas | Shared public shell and clearer card hierarchy |
| 3 | `/passkey` | Passkey entry / returning member | Photo avatars conflict with brand; benefits and actions compete | Illustrated family portraits, stable action stack, 375 px locale QA |
| 4 | `/guardian/accept` | Accept guardian invitation / invitee | Photographic banker and long content reduce trust hierarchy | Illustration-led invite summary and restrained trust cues |
| 5 | `/login` | Email sign-in / existing user | Generic centered form, faint fields, excessive desktop whitespace | Branded auth frame, visible fields, compact supporting copy |
| 6 | `/sign-up` | Account creation / new user | Same generic shell; weak step context | Branded auth frame and consistent form rhythm |
| 7 | `/verify-email` | Email verification / new user | State is visually quiet and disconnected | Clear status illustration and primary next action |
| 8 | `/forgot-password` | Start password reset / existing user | Generic utility form | Auth frame, reassuring status/help hierarchy |
| 9 | `/reset-password` | Complete password reset / existing user | Generic utility form | Consistent auth frame and visible completion state |
| 10 | `/unauthorized` | Access denied / any user | Generic centered message | Product error state with plain-language recovery action |
| 11 | `/recovery` | Recovery entry / wallet owner | Clear flow but weak progress context | Consistent recovery header and state illustration |
| 12 | `/recovery/find-wallet` | Locate wallet / wallet owner | Input-first layout lacks trust support | Stronger field grouping and privacy reassurance |
| 13 | `/recovery/sent` | Recovery request sent / wallet owner | Confirmation lacks visual distinction | Dedicated sent state with concise next-step card |
| 14 | `/recovery/progress` | Recovery approvals / wallet owner | Dense count/status relationship | Progress visualization and calmer supporting copy |
| 15 | `/recovery/countdown` | Recovery waiting period / wallet owner | Progress state can be more scannable | Unified timeline/progress treatment |
| 16 | `/recovery/done` | Recovery completion / wallet owner | Completion is understated | Positive completion illustration and one clear exit |
| 17 | `/setup` | Wallet setup entry / new owner | Photographic presenter; cards compete | Original family illustration and progressive disclosure |
| 18 | `/setup/assistant` | Guided setup / new owner | Utility styling | Shared step header and accessible choice cards |
| 19 | `/setup/choose-guardians` | Choose setup style / new owner | Choices need stronger comparison | Consistent selection cards; no rule changes |
| 20 | `/setup/invite` | Invite guardians / new owner | People imagery varies; long list pressure | Illustrated portraits and clearer invitation grouping |
| 21 | `/setup/threshold` | Choose approvals needed / new owner | Technical-feeling control | Plain visual explanation while preserving values |
| 22 | `/setup/timelock` | Choose waiting period / new owner | Time choice lacks consequence hierarchy | Layered explanation and consistent choice states |
| 23 | `/setup/review` | Review wallet rules / new owner | Dense review stack | Sectioned summary with hard/soft visual distinction |
| 24 | `/setup/done` | Setup completion / new owner | Completion lacks navigation continuity | Branded success state and stable next action |
| 25 | `/wallet` | Wallet home / owner | Good foundation; no persistent app navigation | Responsive hub width and signed-in navigation |
| 26 | `/wallet/send` | Send money / owner | Strong focus but action context is isolated | Consistent flow frame and safer visual emphasis |
| 27 | `/wallet/receive` | Receive money / owner | QR and instructions need clearer hierarchy | Balanced QR card and copyable address grouping |
| 28 | `/wallet/history` | Activity history / owner | States exist; scanning can improve | Unified rows, filters, skeleton/error/empty visuals |
| 29 | `/guardians` | Guardian management / owner | Photo avatars and no hub navigation | Illustrated portraits, responsive roster, app navigation |
| 30 | `/guardians/$guardianId` | Guardian detail / owner | Detail state is visually flat | Identity header and grouped permissions/status |
| 31 | `/guardian` | Guardian inbox / guardian | Photo identity cues; actions feel disconnected | Illustrated identity, consistent guardian workspace |
| 32 | `/guardian/initiate` | Initiate guardian action / guardian | Long form hierarchy | Sectioned review frame; preserve exact action flow |
| 33 | `/guardian/approve-warning` | Risk warning / guardian | Warning can feel alarmist | Calm, high-contrast warning state with one decision |
| 34 | `/guardian/approve` | Approve request / guardian | Dense request summary | Clear “what / who / when” summary and action boundary |
| 35 | `/guardian/approved` | Approval complete / guardian | Generic completion | Branded approval success state |
| 36 | `/guardian/approve-intent` | Confirm intent / guardian | Excluded from current visual suite | Add full responsive/state coverage and shared frame |
| 37 | `/block` | Protection entry / owner | Protection choices lack layered meaning | Strong hard/soft safety model without logic changes |
| 38 | `/block/confirm` | Confirm protection / owner | Dense confirmation and risk text | Prioritized consequence summary and button separation |
| 39 | `/block/done` | Protection complete / owner | Generic completion | Product completion state |
| 40 | `/night-watch` | Safety center / owner | Photographic identity and no hub navigation | Illustration-led status hub and signed-in navigation |
| 41 | `/night-watch/alert` | Suspicious-activity alert / owner | Photo avatar and dense urgency | Calm alert hierarchy, illustrated guardian identity |
| 42 | `/night-watch/guardian-view` | Guardian safety view / guardian | Photographic tablet scene | Original illustration/state composition |
| 43 | `/night-watch/log` | Safety event history / owner | Functional list; visual rhythm varies | Unified activity-row and status treatments |
| 44 | `/night-watch/waiting` | Waiting state / owner | Static waiting state | Gentle motion-safe progress illustration |
| 45 | `/night-watch/resolve` | Resolve alert / owner | Choice hierarchy needs stronger separation | Clear resolution choices; preserve mutation behavior |
| 46 | `/inheritance` | Inheritance planning / owner | Photographic adviser and dense explanation | Original family illustration and layered plan summary |
| 47 | `/inheritance/heartbeat` | Check-in / owner | Utility state | Friendly, unambiguous check-in surface |
| 48 | `/inheritance/claim` | Start/continue claim / beneficiary | High-stakes form needs calmer hierarchy | Trust-first claim frame; preserve requirements |
| 49 | `/settings` | Wallet settings / owner | Query states are weak; hard/soft settings look alike | Full loading/error/empty visuals and layered safety cards |
| 50 | `/protecting` | Active protection status / owner | Excluded from current visual suite | Dedicated protected state and responsive coverage |
| 51 | `/admin` | Operations overview / admin | Generic shell differs from product; sparse desktop | Token-aligned wide operations workspace |
| 52 | `/admin/users` | User operations / admin | Dense table and partial state coverage | Responsive table/card modes and complete UI states |
| 53 | `/admin/sessions` | Access activity / admin | Technical wording and dense table | Plain-language labels and scannable activity rows |
| 54 | `/admin/settings` | Operations settings / admin | Internal-looking labels and weak grouping | Clear sections and status boundaries |
| 55 | Root not-found | Unknown URL / any user | Generic centered text | Branded recoverable empty state |
| 56 | Root error | Unexpected render error / any user | Generic centered text | Branded error state with retry/home hierarchy |

## Quantitative baseline

Counts are static presentation-source counts, excluding tests.

| Measure | Baseline | Finding |
|---|---:|---|
| Rendered route screens | 54 | Current visual suite covers 41 |
| Global error surfaces | 2 | Not included in route visual matrix |
| Hex literals | 26 | Too many literals outside the semantic layer |
| RGB/RGBA literal variants | 27 | Mostly duplicated surface and shadow values |
| Tailwind text-size utilities | 8 | Plus 10 raw CSS declarations; effective scale is too broad |
| Raw radius declarations | 13 | Plus 5 utility variants; no single radius contract |
| Icon sources | 2 | Repo SVG icons in the app, Lucide in the shared UI package |
| Locale leaf keys | 813 × 3 | English, Vietnamese, and Chinese structures are currently in parity |
| Existing route snapshots | 82 | 41 routes × 2 mobile sizes |

## Asset audit

All current people assets were previously generated, but their photorealistic
treatment reads as generic financial stock imagery and conflicts with the new
brief.

| Asset family | Current use | Decision |
|---|---|---|
| `assets/characters/european-family-hero.*` | Welcome, invitation, setup, inheritance, family safety | Use the approved semi-realistic European family system |
| `assets/characters/family-guide-{wave,wait}.*` | Completion and waiting states | Use the same young adult family member in consistent poses |
| `assets/characters/guardians/guardian-{1..6}.webp` | Guardian identities and clusters | Use the approved semi-realistic European portrait set |
| `icons/*.png` and `og.jpg` | PWA and social surfaces | Keep character identity consistent with the in-app family |
| Former `assets/illustrations/*`, `assets/mascot/*`, cartoon SVG portraits | Retired | Removed from production and recoverable from Git history |

New imagery must remain decorative or supportive. Identity, amount, status, and
decision meaning must always remain available as text.

## System findings

### Tokens

`components/family/theme.css` and `components/family/family.css` define overlapping
primitive systems. The shared package also carries a duplicate theme file. This
causes colors, radii, shadows, and typography to drift between product, auth, and
admin surfaces.

### Navigation

Signed-in screens rely on route-specific cards and a full-width user menu in a
compact header. There is no persistent navigation for Wallet, Guardians, Safety,
and Settings. This is the largest cross-screen orientation gap.

### States

Wallet, history, guardian approvals, blocking, inheritance, Night Watch, protection,
and most setup/recovery query screens already render useful loading, error, or empty
states. Gaps remain in settings policy queries, parts of admin, auth submission
feedback, and the global error/not-found surfaces.

### Copy

Translation structures are healthy and must not change. Several English/admin
values expose technical phrases such as session, smart contract, on-chain, registry,
and spending limit. Values can be rewritten in plain language while every key,
interpolation, and behavior remains unchanged.

### Responsive and locale risk

- Manual 375 × 812 checks on `/passkey` pass in English, Vietnamese, and Chinese
  without horizontal overflow or clipped actions.
- `/login` at 1440 × 900 is too sparse and visually disconnected.
- Existing automated widths are 320, 390, 400, 430, and 1024 px; exact 375 px,
  desktop-wide route coverage, keyboard traversal, and all-locale route coverage
  are incomplete.
- Dense admin tables, long auth labels, guardian action cards, and the signed-in
  header are the highest clipping risks.

## Approved UX/UI change map

1. Consolidate the product onto one semantic token contract: 8 base colors, 6 type
   sizes, 3 radii, and 3 shadows.
2. Replace photographic people and avatar assets with an original family
   illustration plus inline SVG portraits and states.
3. Unify public, auth, product, and admin framing while retaining the existing route
   tree and all guards.
4. Add presentation-only persistent signed-in navigation and a compact accessible
   user menu.
5. Distinguish hard protection rules from flexible preferences through layout,
   iconography, and surface treatment only.
6. Complete loading, error, empty, and success presentation gaps without changing
   query or mutation semantics.
7. Rewrite exposed technical copy by editing translation values only; key structure
   remains byte-for-byte compatible.
8. Expand responsive, locale, keyboard, asset, and route-state verification to the
   full surface inventory.

## Final verification

- Runtime asset scan: **54/54 routes passed**, with zero response, console,
  page, image, SVG, or font failures.
- Responsive matrix: **378/378 combinations passed** across 320, 375, 390,
  400, 430, 1024, and 1440 px widths.
- Visual regression: **108/108 snapshots passed** at 375 × 812 and 400 × 560.
- Exact 375 px keyboard coverage passed in English, Vietnamese, and Chinese.
- Source palette: **8 base hex colors**, zero RGB/RGBA literals.
- Icon sources: **1 repo-owned SVG system**; zero `lucide-react` references.
- Shape/type contract: **6 type sizes, 3 radii, and 3 shadows**.
- Protected scope audit: no changed file under `be/`, `contracts/`, an API
  client directory, or `_redirects`.
