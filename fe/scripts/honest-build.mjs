#!/usr/bin/env node
// ============================================================================
// HONEST BUILD — the ONLY build command for verify/deploy (`pnpm build`).
//
// Why this exists: Bun and Node >= 23.6 strip TypeScript types by default, so
// a host-loaded config that imports a cross-package `.ts` file builds GREEN
// locally but DIES on a clean Node 20/22 host (Cloudflare CI) with
// ERR_UNKNOWN_FILE_EXTENSION. This wrapper disables type-stripping so the
// local build mirrors the strictest deploy host.
//
// Why a wrapper instead of `NODE_OPTIONS=... turbo run build` in package.json:
//   1. POSIX inline-env syntax breaks on Windows (cmd.exe).
//   2. `--no-experimental-strip-types` is UNKNOWN to Node < 22.6 — putting it
//      in NODE_OPTIONS there makes node exit immediately. Node 20/22 can't
//      strip types anyway (naturally honest), so the flag is only added where
//      it exists AND matters.
// `--force` bypasses the turbo cache: a green artifact cached under a
// type-stripping run must never be replayed as "honest".
// ============================================================================
import { spawnSync } from "node:child_process";

const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
const FLAG = "--no-experimental-strip-types";
// Node >= 22.6 knows the flag (strip-types introduced 22.6, default ON >= 23.6).
const nodeKnowsFlag = major > 22 || (major === 22 && minor >= 6);

const base = process.env.NODE_OPTIONS ?? "";
const nodeOptions = nodeKnowsFlag && !base.includes(FLAG) ? `${base} ${FLAG}`.trim() : base;

console.log(
  `[honest-build] node v${process.versions.node} · NODE_OPTIONS="${nodeOptions}" · turbo run build --force`,
);

const result = spawnSync("pnpm", ["exec", "turbo", "run", "build", "--force"], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  // pnpm is a .cmd shim on Windows — needs a shell to resolve.
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("[honest-build] failed to spawn pnpm/turbo:", result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
