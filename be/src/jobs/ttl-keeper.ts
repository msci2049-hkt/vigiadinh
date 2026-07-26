// Cron GIA HẠN TTL — TỐI ƯU PHÍ, không phải điểm chết (đính chính 2026-07-25).
//
// Đọc kỹ trước khi sửa hoặc gỡ: job này KHÔNG phải thứ giữ cho ví sống. Từ
// Protocol 23 (CAP-0066), entry đã archive được TỰ ĐỘNG khôi phục khi xuất hiện
// trong footprint của `InvokeHostFunctionOp` — danh sách khôi phục do simulation
// qua RPC tự điền. Nghĩa là người thừa kế nhiều năm sau cứ gọi hợp đồng như bình
// thường, dữ liệu sống lại trong chính giao dịch đó (chỉ tốn phí khôi phục).
// Công ty giải thể KHÔNG brick ví. Xem docs/INHERITANCE.md.
//
// Việc job này làm: gia hạn định kỳ để dữ liệu hiếm khi rơi vào trạng thái
// archive, nên người dùng không gặp khoản phí khôi phục bất ngờ. Đó là tiện
// lợi và tiết kiệm, không phải sống còn.
//
// CẤM ghi ở bất cứ đâu rằng "cron chết thì mất ví" — sai, và làm người đọc sợ
// nhầm chỗ.
//
// Chạy MỖI NGÀY 03:00 UTC. Ví phí trả — người dùng không phải biết chuyện này.
// Lỗi MỘT ví không được làm hỏng lượt của ví khác (một ví chưa deploy/đã archive
// không phải lý do để 999 ví còn lại mất lượt gia hạn).

import { Address, xdr } from "@stellar/stellar-sdk";
import { Queue, Worker } from "bullmq";
import { db } from "@/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { bullConnection } from "@/lib/redis";
import { redlock } from "@/lib/redlock";
import { wallets } from "@/modules/wallets/infra/wallets.schema";
import { invokeWithSignedEntries } from "@/services/stellar/stellar.service";
import {
  contractCodeKey,
  contractInstanceKey,
  extendEntriesTtl,
  fetchWasmHashHex,
} from "@/services/stellar/ttl.service";

export const TTL_KEEPER_QUEUE = "{ttl-keeper}";

/** Ngưỡng/mốc gia hạn (ledger) — khớp hằng trong contract registry. */
const TTL_THRESHOLD = 300_000;
const TTL_EXTEND_TO = 3_110_400;

// Trần phí per-tx (stroops). `extend_ttl` rất rẻ (~vài chục nghìn stroops); đặt
// 5_000_000 (0.5 XLM) là dư xa cho tx thật nhưng chặn cost-attack B-SEC-3: một
// contract do kẻ tấn công khai (POST /api/wallets nhận C… bất kỳ) để extend_ttl
// ngốn tài nguyên tối đa sẽ vượt trần → bị bỏ qua, ví phí không mất gì.
const TTL_MAX_FEE_STROOPS = 5_000_000;
// Trần số ví mỗi lượt — bó việc một tick, chống bơm bảng wallets thành DoS.
const TTL_MAX_WALLETS_PER_TICK = 1_000;

export const ttlKeeperQueue = new Queue(TTL_KEEPER_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
    removeOnFail: { age: 30 * 24 * 3600 },
  },
});

export async function scheduleTtlKeeper(): Promise<void> {
  await ttlKeeperQueue.add(
    "tick",
    {},
    { repeat: { pattern: "0 3 * * *", tz: "UTC" }, jobId: "ttl-keeper-cron" },
  );
}

export type TtlResult = {
  extended: number;
  failed: number;
  skipped: boolean;
  /** Entry HẠ TẦNG (verifier/web-auth/registry instance + wasm code) — mục F. */
  infra: { extended: number; failed: number };
};

export type InfraTtlTarget = { label: string; key: xdr.LedgerKey };

export type InfraTtlDeps = {
  /** Gia hạn một bó ledger key (thật: ttl.service.extendEntriesTtl). */
  extend: (keys: xdr.LedgerKey[]) => Promise<unknown>;
  /** Wasm hash hex theo contract id (thật: ttl.service.fetchWasmHashHex). */
  wasmHashHexOf: (contractIds: string[]) => Promise<Map<string, string>>;
};

/**
 * Gom entry HẠ TẦNG cần gia hạn từ env (mục F — CONTRACT-DUMP.md bảng (b)):
 *   · instance origin-verifier + web-auth (2 contract KHÔNG có hàm extend_ttl);
 *   · instance registry (extend_ttl(wallet) chỉ chạy khi CÓ ví — 0 ví thì đây
 *     là đường gia hạn duy nhất);
 *   · CODE entry của 3 contract trên (hash tự khám phá qua RPC — không cần env);
 *   · CODE entry smart-account (env ACCOUNT_WASM_HASH — mọi ví dùng chung,
 *     extend_ttl từng ví không chạm tới nó).
 * Export riêng để test khoá danh sách target theo env.
 */
export async function collectInfraTtlTargets(
  deps: Pick<InfraTtlDeps, "wasmHashHexOf">,
): Promise<InfraTtlTarget[]> {
  const contracts: Array<[label: string, id: string | undefined]> = [
    ["origin-verifier", env.CONTRACT_ID_ORIGIN_VERIFIER],
    ["web-auth", env.SEP45_WEB_AUTH_CONTRACT_ID],
    ["recovery-registry", env.CONTRACT_ID_RECOVERY],
  ];
  const present = contracts.filter((c): c is [string, string] => Boolean(c[1]));
  const targets: InfraTtlTarget[] = present.map(([label, id]) => ({
    label: `${label}:instance`,
    key: contractInstanceKey(id),
  }));
  const hashes = await deps.wasmHashHexOf(present.map(([, id]) => id));
  for (const [label, id] of present) {
    const hashHex = hashes.get(id);
    if (hashHex) targets.push({ label: `${label}:code`, key: contractCodeKey(hashHex) });
  }
  if (env.ACCOUNT_WASM_HASH) {
    targets.push({ label: "smart-account:code", key: contractCodeKey(env.ACCOUNT_WASM_HASH) });
  }
  return targets;
}

/**
 * Gia hạn hạ tầng — MỖI target MỘT tx: một contract chưa deploy (entry không
 * tồn tại → simulate fail) không được làm hỏng lượt của các entry còn lại,
 * cùng triết lý vòng per-wallet bên dưới.
 */
export async function extendInfraTtl(deps: InfraTtlDeps): Promise<{
  extended: number;
  failed: number;
}> {
  let targets: InfraTtlTarget[];
  try {
    targets = await collectInfraTtlTargets(deps);
  } catch (err) {
    logger.warn({ err }, "ttl.infra.collect.failed");
    return { extended: 0, failed: 1 };
  }
  let extended = 0;
  let failed = 0;
  for (const target of targets) {
    try {
      await deps.extend([target.key]);
      extended += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ err, target: target.label }, "ttl.infra.extend.failed");
    }
  }
  return { extended, failed };
}

/**
 * Một lượt gia hạn. Trả số ví gia hạn được / hỏng để log — KHÔNG throw khi một
 * ví hỏng, vì lượt sau phải chạy tiếp cho những ví còn lại.
 */
export async function runTtlKeeperTick(): Promise<TtlResult> {
  // Hạ tầng TRƯỚC, độc lập với CONTRACT_ID_RECOVERY: web-auth/verifier có thể
  // được cấu hình trước khi có ví nào. Cần ví phí để trả tx — thiếu thì bỏ qua
  // (log ở /ready đã phơi trạng thái thiếu cấu hình).
  const infra = env.FEE_WALLET_SECRET
    ? await extendInfraTtl({
        extend: (keys) =>
          extendEntriesTtl({
            keys,
            extendTo: TTL_EXTEND_TO,
            maxFeeStroops: TTL_MAX_FEE_STROOPS,
          }),
        wasmHashHexOf: fetchWasmHashHex,
      })
    : { extended: 0, failed: 0 };

  if (!env.CONTRACT_ID_RECOVERY) {
    // Chưa cấu hình registry → không có ví nào để gia hạn, app vẫn sống.
    return { extended: 0, failed: 0, skipped: true, infra };
  }
  const rows = await db
    .select({ address: wallets.stellarAddress })
    .from(wallets)
    .limit(TTL_MAX_WALLETS_PER_TICK);
  let extended = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.address?.startsWith("C")) continue; // chỉ ví hợp đồng
    try {
      // 1) instance + context rule của CHÍNH ví. Trần phí chặn contract độc.
      await invokeWithSignedEntries({
        contractId: row.address,
        method: "extend_ttl",
        args: [xdr.ScVal.scvU32(TTL_THRESHOLD), xdr.ScVal.scvU32(TTL_EXTEND_TO)],
        authEntries: [],
        maxFeeStroops: TTL_MAX_FEE_STROOPS,
      });
      // 2) cấu hình guardian của ví trong registry (archive cái này = mất
      //    danh sách người cứu, dù ví còn sống).
      await invokeWithSignedEntries({
        contractId: env.CONTRACT_ID_RECOVERY,
        method: "extend_ttl",
        args: [new Address(row.address).toScVal()],
        authEntries: [],
        maxFeeStroops: TTL_MAX_FEE_STROOPS,
      });
      extended += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ err, wallet: row.address }, "ttl.extend.failed");
    }
  }
  return { extended, failed, skipped: false, infra };
}

export function createTtlKeeperWorker(): Worker {
  return new Worker(
    TTL_KEEPER_QUEUE,
    async () => {
      await redlock.using(["lock:ttl-keeper"], 10 * 60_000, async () => {
        const result = await runTtlKeeperTick();
        logger.info(result, "ttl.tick");
      });
    },
    { connection: bullConnection },
  );
}
