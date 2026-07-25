# FamilyWallet — 39-screen UI rebuild log

Date: 2026-07-25  
Scope: presentation, interaction clarity, responsive layout and visual assets only. Existing
queries, mutations, API endpoints, passkey calls, Stellar signing, blind-sign guards, state
machines and navigation destinations remain intact.

## System delivered

- Three-layer primitive → semantic → component tokens in `@repo/ui/theme.css`.
- Local Fraunces, Inter and JetBrains Mono variable fonts; no runtime Google Fonts request.
- Fixed Lucide icon map, 1.5 px stroke, 20/24/32 px sizes.
- Primary, secondary, ghost, danger and link buttons with hover, pressed, disabled and loading.
- Shared product screen/header/primary zone, guardian cluster, biometric gate, status pill,
  timelock countdown, sheet, semantic error banner and read-state components.
- Generated banker, mascot, guardian avatar and social assets documented in
  `docs/ASSET-MANIFEST.md`.
- English, Vietnamese and Simplified Chinese catalogs at equal key parity.

## Screen completion

| # | Route | UI state |
|---:|---|---|
| 1 | `/welcome` | Complete |
| 2 | `/get-started` | Complete |
| 3 | `/setup` | Complete |
| 4 | `/setup/choose-guardians` | Complete |
| 5 | `/setup/threshold` | Complete |
| 6 | `/setup/timelock` | Complete |
| 7 | `/setup/review` | Complete |
| 8 | `/setup/done` | Complete |
| 9 | `/setup/invite` | Complete |
| 10 | `/setup/assistant` | Complete through shared wizard shell |
| 11 | `/wallet` | Complete; balance intentionally not fabricated because no balance endpoint exists |
| 12 | `/wallet/send` | Complete for enter, review, signing, guardian wait, unconfirmed and settled states |
| 13 | `/wallet/receive` | Complete |
| 14 | `/wallet/history` | Complete |
| 15 | `/guardians` | Complete |
| 16 | `/guardians/$guardianId` | Complete |
| 17 | `/guardian` | Complete |
| 18 | `/guardian/approve` | Complete |
| 19 | `/guardian/approve-warning` | Complete |
| 20 | `/guardian/approved` | Complete |
| 21 | `/recovery` | Complete |
| 22 | `/recovery/find-wallet` | Complete |
| 23 | `/recovery/sent` | Complete |
| 24 | `/recovery/progress` | Complete |
| 25 | `/recovery/countdown` | Complete |
| 26 | `/recovery/done` | Complete |
| 27 | `/block` | Complete |
| 28 | `/block/confirm` | Complete |
| 29 | `/block/done` | Complete |
| 30 | `/night-watch` | Complete |
| 31 | `/night-watch/alert` | Complete |
| 32 | `/night-watch/log` | Complete |
| 33 | `/night-watch/resolve` | Complete |
| 34 | `/night-watch/waiting` | Complete |
| 35 | `/night-watch/guardian-view` | Complete |
| 36 | `/inheritance` | Complete |
| 37 | `/inheritance/heartbeat` | Complete |
| 38 | `/inheritance/claim` | Complete |
| 39 | `/passkey` | Complete |

Existing operational routes `/guardian/accept` and `/guardian/initiate` were also brought into
the same system because real invite/recovery links land there.

## Truthful deviations

- `/wallet` does not display a made-up balance. The current FE/BE contract has no balance query;
  address and real protection state are shown instead.
- `/wallet/receive` uses a QR icon, address and working copy action. A fake non-scannable QR
  payload was not generated.
- The task explicitly requested generated characters throughout the experience, so a small
  number of calm editorial character/mascot assets are used beyond landing while all financial
  data remains real.
- The recipient input still accepts both `G…` and `C…` because changing validation would alter
  existing behavior. Its visible placeholder is `C…` to match the product architecture.

## Verification

- Mobile visual QA at 390×844 on `/welcome`, `/get-started`, `/passkey` and `/recovery`.
  Primary actions land at y=684 and secondary actions at y=752 without page overflow.
- Async-i18n QA found translated copy being used as React list keys on three screens. Stable,
  language-independent keys now prevent empty duplicate rows during initial namespace loading.
- Frontend validation, type checking, boundary checks, localization parity, 108 tests and the
  production PWA build pass.
- Backend source was scanned for route contracts and API parity but was not changed as part of
  this UI rebuild.
