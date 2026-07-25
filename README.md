# FamilyWallet (VíGiaĐình)

A Stellar wallet **your family can recover** — no seed phrase, ever.

Custody lives **on-chain** in a Soroban smart account. The passkey never leaves the
device's secure enclave. If you lose your phone, the people you trust approve a key
rotation from *their own* devices — the wallet address never changes, and no guardian
can ever spend your money.

| Capability | How it works |
|---|---|
| **No seed phrase** | Passkey (WebAuthn secp256r1) → smart account `__check_auth` |
| **Social recovery** | Guardians + threshold + timelock + owner veto, enforced by contract |
| **Guardians can't steal** | Guardians are *never* signers on the owner's wallet — they vote in a separate registry |
| **Inheritance** | Heartbeat ("I'm fine") + heir claim with % split |
| **Night watch** | AI that only *warns* — it holds no key and has no write access |

Backend outage or compromise loses **no money and no ability to recover**.

---

## Requirements

Versions below are what CI pins. Mismatches are the usual cause of "works here, red there".

| Tool | Version | Needed for |
|---|---|---|
| Bun | 1.3.11+ | `be/` |
| Node | 20 / 22 / 24 (CI matrix); `.nvmrc` says 20 | `fe/` |
| pnpm | **9.15.9** (from `fe/package.json` `packageManager`) | `fe/` — use `corepack pnpm` |
| Rust | 1.91.0+ with target `wasm32v1-none` | `contracts/` |
| stellar-cli | 27.0.0 | `contracts/` |
| Docker | any recent | Postgres + Dragonfly + Mailhog |

> `fe/` uses **pnpm only** and `be/` uses **bun only**. Never `bun install` in `fe/`,
> never `pnpm i` in `be/`. There are no root workspaces — see `CLAUDE.md`.

---

## Quick start

### 1. Backend (`be/`) — Bun + Hono + Postgres

```bash
cd be
bun install --frozen-lockfile
cp .env.example .env
```

**Edit `.env` before going further.** `DATABASE_URL` ships as a placeholder and will
fail as-is. With the stock `docker-compose.yml` ports, set:

```dotenv
DATABASE_URL=postgresql://app:app@localhost:5432/app
REDIS_URL=redis://localhost:3699
```

If port 5432 or 3699 is already taken, set `DB_PORT` / `REDIS_PORT` in `.env` and
point `DATABASE_URL` / `REDIS_URL` at the new ports — compose reads them.

```bash
docker compose up -d        # postgres + dragonfly + mailhog (mail UI :8025)
bun run env:check           # verifies env is complete BEFORE the app starts
bun run db:migrate          # applies 0000 → 0007, forward-only, no manual steps
bun run dev                 # API on :3000
bun run worker              # BullMQ worker, separate process
```

No manual seeding is required — the app runs against an empty schema.

### 2. Frontend (`fe/`) — React 19 + Vite + TanStack

```bash
cd fe
corepack pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env    # REQUIRED — without it the page renders blank
corepack pnpm dev:web                     # http://localhost:5173
```

`VITE_API_URL` must equal the backend's `BETTER_AUTH_URL` (`http://localhost:3000`),
and the frontend origin must be in the backend's `TRUSTED_ORIGINS`.

### 3. Contracts (`contracts/`) — Soroban / Rust

```bash
cd contracts
cargo test --workspace      # 48 tests
stellar contract build      # wasm32v1-none
```

Already deployed on testnet — addresses are in `fe/apps/web/.env.example`. You do not
need to deploy anything to run the app.

---

## Verify it (`validate` = the real gate)

```bash
cd be && bun run validate && bun test              # 249 pass / 9 skip / 0 fail
cd fe && corepack pnpm validate && corepack pnpm build   # honest build
bun run check:contract                             # from repo root — shared/ in sync
```

`pnpm build` in `fe/` is the **only** build that counts as evidence — `vite build` and
`turbo build` can go green on a stripped-types runtime that a clean Node host rejects.

End-to-end (touches real testnet, opt-in):

```bash
cd fe && corepack pnpm --filter @repo/web exec playwright install chromium
RUN_TESTNET_E2E=1 corepack pnpm --filter @repo/web exec playwright test e2e/multi-device --project=chromium
```

---

## Proof

Every claim below points at a real testnet transaction — no mocks, no placeholders.

- **`docs/evidence/TESTNET.md`** — every transaction hash, with what it proves.
- **`docs/evidence/multi-device-latest.json`** — newest multi-device recovery run.
- **`docs/DEMO.md`** — 4-minute demo script ("I lost my phone"), timed, with the
  hash to open behind each beat.

Highlights:

| What | Transaction |
|---|---|
| Passkey (secp256r1) signs a real transfer via `__check_auth` | `e83adb27…` |
| Owner + 2 guardians, **each on a separate device**, register on-chain | `fe874342…` |
| Rotated key signs; old key rejected; cooldown blocks immediate drain | `docs/evidence/TESTNET.md §AUDIT P0` |

---

## Repo map

```
be/         Backend  — Bun + Hono + Drizzle/Postgres + Dragonfly + BullMQ + Better Auth
fe/         Frontend — React 19 + Vite + TanStack + Tailwind 4 (pnpm + Node, NOT bun)
contracts/  Soroban (Rust) — smart-account, recovery-registry, origin-verifier, web-auth
shared/     Source of truth for BE↔FE contracts (enums, state machine, reason codes)
extension/  Browser extension shell (narrow-permission companion)
docs/       Evidence, demo script, threat model, routes, deploy, inheritance
```

`be/`, `fe/` and `contracts/` share one git history but build independently and may
**not** import from each other — they talk over HTTP only.

## Internal documentation (Vietnamese)

- `BUILD-LOG.md` — build journal, phases, commit SHAs
- `BLOCKERS.md` — what is *not* verified and exactly why. Read this before believing
  anything is green.
- `docs/COVERAGE-PRODUCT.md` — every contract function ↔ does a real product path call it?
- `docs/THREAT-MODEL.md`, `docs/INHERITANCE.md`, `docs/ROUTES.md`, `docs/DEPLOY.md`
- `CLAUDE.md` — monorepo rules (read before changing anything)

## Time from clone to running

Measured 2026-07-25 on WSL2 / Linux ext4, warm package caches:

| Step | Time |
|---|---|
| `git clone` | 14s |
| `be`: `bun install --frozen-lockfile` | 21s |
| `be`: `db:migrate` (0000 → 0007, empty DB) | 1.5s |
| `fe`: `pnpm install --frozen-lockfile` (pnpm 9.15.9) | 46s |
| `fe`: `pnpm build` (honest) | 37s |
| **Total** | **≈ 2 minutes** |

⚠️ On a Windows-mounted path (`/mnt/...` under WSL) the same frontend build takes
**4m08s** instead of 37s. That is a filesystem penalty, not the project. Clone to a
native Linux path if you are on WSL.
