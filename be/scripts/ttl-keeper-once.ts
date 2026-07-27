// Chạy MỘT lượt ttl-keeper NGAY (audit T6) — không đợi cron 03:00 UTC, không
// cần worker/Dragonfly: gọi thẳng runTtlKeeperTick() (đúng code path production)
// và ĐO TTL (liveUntilLedgerSeq) của từng entry hạ tầng TRƯỚC/SAU để có bằng
// chứng thật. Cần: DB (bảng wallets) + env Stellar (STELLAR_RPC_URL,
// STELLAR_NETWORK_PASSPHRASE, FEE_WALLET_SECRET, SEP45_WEB_AUTH_CONTRACT_ID /
// CONTRACT_ID_RECOVERY / CONTRACT_ID_ORIGIN_VERIFIER / ACCOUNT_WASM_HASH — biến
// nào thiếu thì target đó tự vắng, xem collectInfraTtlTargets).
//
//   bun run scripts/ttl-keeper-once.ts
//
// Guard mainnet: đây là tool vận hành tay, chạy trên mainnet phải là quyết định
// tường minh — đặt TTL_KEEPER_ALLOW_MAINNET=1 mới cho chạy.
import { rpc as StellarRpc } from "@stellar/stellar-sdk";
import { env } from "@/env";
import { collectInfraTtlTargets, type InfraTtlTarget, runTtlKeeperTick } from "@/jobs/ttl-keeper";
import { fetchWasmHashHex } from "@/services/stellar/ttl.service";

const MAINNET = "Public Global Stellar Network ; September 2015";
if (env.STELLAR_NETWORK_PASSPHRASE === MAINNET && process.env.TTL_KEEPER_ALLOW_MAINNET !== "1") {
  console.error("⛔ Đang trỏ MAINNET — set TTL_KEEPER_ALLOW_MAINNET=1 nếu thật sự muốn.");
  process.exit(1);
}

const server = new StellarRpc.Server(env.STELLAR_RPC_URL);

async function readTtls(targets: InfraTtlTarget[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (targets.length === 0) return out;
  const res = await server.getLedgerEntries(...targets.map((t) => t.key));
  for (const t of targets) {
    const hit = res.entries.find((e) => e.key.toXDR("base64") === t.key.toXDR("base64"));
    out.set(t.label, hit?.liveUntilLedgerSeq ?? null);
  }
  return out;
}

const latest = await server.getLatestLedger();
console.log(`network: ${env.STELLAR_NETWORK_PASSPHRASE}`);
console.log(`rpc: ${env.STELLAR_RPC_URL} · ledger hiện tại: ${latest.sequence}`);

const targets = await collectInfraTtlTargets({ wasmHashHexOf: fetchWasmHashHex });
const before = await readTtls(targets);
console.log("\n--- TTL TRƯỚC (liveUntilLedgerSeq) ---");
for (const [label, ttl] of before) console.log(`  ${label}: ${ttl ?? "(entry không tồn tại)"}`);

const startedAt = new Date().toISOString();
const result = await runTtlKeeperTick();
console.log(`\nruns runTtlKeeperTick() @ ${startedAt} →`, JSON.stringify(result));

const after = await readTtls(targets);
console.log("\n--- TTL SAU (liveUntilLedgerSeq) ---");
for (const [label, ttl] of after) {
  const b = before.get(label);
  const delta = typeof ttl === "number" && typeof b === "number" ? ` (Δ +${ttl - b})` : "";
  console.log(`  ${label}: ${ttl ?? "(entry không tồn tại)"}${delta}`);
}
process.exit(0);
