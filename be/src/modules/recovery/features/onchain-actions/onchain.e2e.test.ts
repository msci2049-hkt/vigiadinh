// E2E TESTNET THẬT (GATE PHA 5) — 3 luồng: thiết lập · khôi phục timelock thật ·
// veto khẩn. Chạm mạng thật + tốn phí ví hệ thống → opt-in tường minh:
//   RUN_TESTNET_E2E=1 bun test onchain.e2e
// Cần: Postgres sống + FEE_WALLET_SECRET + CONTRACT_ID_RECOVERY trong .env.
// Ký ở đây bằng ed25519 CLASSIC (authorizeEntry SDK) — đúng vai FE của registry
// spike; đường ký passkey/smart-account là chuyện contract smart-account (PHA 6+).
import { afterAll, describe, expect, it } from "bun:test";
import { Address, authorizeEntry, Keypair, xdr } from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/env";
import {
  buildInvokeTx,
  invokeWithSignedEntries,
  StellarServiceError,
  simulateRead,
} from "@/services/stellar/stellar.service";
import { pgReachable } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { contractErrorCode, finalizeArgs } from "../../domain/onchain";
import {
  buildRecoveryAction,
  finalizeRecovery,
  type OnchainGateway,
  submitRecoveryAction,
} from "./service";

const dbUp = await pgReachable();
const enabled =
  dbUp &&
  process.env.RUN_TESTNET_E2E === "1" &&
  Boolean(env.FEE_WALLET_SECRET) &&
  Boolean(env.CONTRACT_ID_RECOVERY);
const testIt = enabled ? it : it.skip;
if (!enabled) {
  console.warn(
    "SKIP e2e testnet: cần RUN_TESTNET_E2E=1 + Postgres + FEE_WALLET_SECRET + CONTRACT_ID_RECOVERY",
  );
}

const REGISTRY = env.CONTRACT_ID_RECOVERY ?? "";
const gateway: OnchainGateway = {
  build: buildInvokeTx,
  invoke: invokeWithSignedEntries,
  read: simulateRead,
};

// Diễn viên: 2 chủ ví (2 luồng độc lập) + 2 guardian dùng chung + chủ mới đề cử.
const owner1 = Keypair.random();
const owner2 = Keypair.random();
const g1 = Keypair.random();
const g2 = Keypair.random();
const newOwner = Keypair.random();

const OWNER1_USER = `e2e-o1-${crypto.randomUUID().slice(0, 8)}`;
const OWNER2_USER = `e2e-o2-${crypto.randomUUID().slice(0, 8)}`;
const G1_USER = `e2e-g1-${crypto.randomUUID().slice(0, 8)}`;
const G2_USER = `e2e-g2-${crypto.randomUUID().slice(0, 8)}`;

const cleanupWalletIds: string[] = [];
/** Bằng chứng nộp hồ sơ: mọi tx hash in ra cuối run (docs/evidence/TESTNET.md). */
const txEvidence: Array<{ step: string; hash: string }> = [];

async function friendbot(kp: Keypair): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  // 400 = account đã tồn tại (chạy lại) — chấp nhận.
  if (!res.ok && res.status !== 400) {
    throw new Error(`friendbot ${kp.publicKey()}: HTTP ${res.status}`);
  }
}

async function seedWalletRow(input: {
  ownerUser: string;
  address: string;
  timelockSecs: number;
}): Promise<string> {
  const [w] = await db
    .insert(wallets)
    .values({
      userId: input.ownerUser,
      stellarAddress: input.address,
      threshold: 2,
      timelockSecs: input.timelockSecs,
    })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  await db.insert(guardians).values([
    { walletId: w.id, userId: G1_USER, onchainKey: g1.publicKey(), status: "active" },
    { walletId: w.id, userId: G2_USER, onchainKey: g2.publicKey(), status: "active" },
  ]);
  return w.id;
}

/** Ký MỌI entry build trả về bằng keypair khớp địa chỉ credentials — vai FE. */
async function signEntries(
  authEntriesXdr: string[],
  latestLedger: number,
  signers: Keypair[],
): Promise<string[]> {
  const byAddress = new Map(signers.map((kp) => [kp.publicKey(), kp]));
  const validUntil = latestLedger + 120;
  const signed: string[] = [];
  for (const b64 of authEntriesXdr) {
    const entry = xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64");
    const address = Address.fromScAddress(entry.credentials().address().address()).toString();
    const signer = byAddress.get(address);
    if (!signer) throw new Error(`không có keypair cho entry ${address}`);
    const done = await authorizeEntry(entry, signer, validUntil, env.STELLAR_NETWORK_PASSPHRASE);
    signed.push(done.toXDR("base64"));
  }
  return signed;
}

async function buildSignSubmit(input: {
  action: "register" | "initiate" | "approve" | "veto";
  walletId: string;
  userId: string;
  signers: Keypair[];
  newOwner?: string;
  step: string;
}): Promise<{ hash: string; status: string }> {
  const built = await buildRecoveryAction(gateway, REGISTRY, {
    action: input.action,
    walletId: input.walletId,
    userId: input.userId,
    ...(input.newOwner ? { newOwner: input.newOwner } : {}),
  });
  expect(built.authEntriesXdr.length).toBeGreaterThan(0);
  const signed = await signEntries(built.authEntriesXdr, built.latestLedger, input.signers);
  const result = await submitRecoveryAction(gateway, REGISTRY, {
    walletId: input.walletId,
    userId: input.userId,
    signedEntriesXdr: signed,
  });
  expect(result.status).toBe("SUCCESS");
  txEvidence.push({ step: input.step, hash: result.hash });
  return result;
}

async function readStatus(address: string): Promise<Record<string, unknown>> {
  return (await simulateRead({
    contractId: REGISTRY,
    method: "get_recovery_status",
    args: finalizeArgs({ wallet: address }),
  })) as Record<string, unknown>;
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id));
  }
  if (txEvidence.length > 0) {
    console.warn("=== TX EVIDENCE (chép vào docs/evidence/TESTNET.md) ===");
    for (const t of txEvidence) {
      console.warn(`${t.step}: https://stellar.expert/explorer/testnet/tx/${t.hash}`);
    }
  }
});

describe("e2e testnet — 3 luồng GATE PHA 5", () => {
  testIt(
    "chuẩn bị: friendbot fund 4 account (owner1, owner2, g1, g2)",
    async () => {
      await Promise.all([friendbot(owner1), friendbot(owner2), friendbot(g1), friendbot(g2)]);
    },
    60_000,
  );

  testIt(
    "luồng 1 — THIẾT LẬP: register_wallet qua route service, owner ký entry thật",
    async () => {
      const walletId = await seedWalletRow({
        ownerUser: OWNER1_USER,
        address: owner1.publicKey(),
        timelockSecs: 6, // timelock NGẮN cho luồng 2 chờ thật
      });
      await buildSignSubmit({
        action: "register",
        walletId,
        userId: OWNER1_USER,
        signers: [owner1],
        step: "register-w1",
      });
      const registered = await simulateRead({
        contractId: REGISTRY,
        method: "is_registered",
        args: finalizeArgs({ wallet: owner1.publicKey() }),
      });
      expect(registered).toBe(true);
    },
    120_000,
  );

  testIt(
    "luồng 2 — KHÔI PHỤC TIMELOCK THẬT: initiate(g1) → approve đủ ngưỡng → chờ → finalize",
    async () => {
      const walletId = cleanupWalletIds[0];
      if (!walletId) throw new Error("luồng 1 chưa chạy");
      await buildSignSubmit({
        action: "initiate",
        walletId,
        userId: G1_USER,
        signers: [g1],
        newOwner: newOwner.publicKey(),
        step: "initiate-w1",
      });

      // Ngưỡng 2 — initiator có được đếm sẵn không tuỳ contract: đọc số phiếu
      // thật rồi approve tới đủ (không đoán).
      let status = await readStatus(owner1.publicKey());
      let approvals = (status.approvals as unknown[]).length;
      for (const [kp, user] of [
        [g1, G1_USER],
        [g2, G2_USER],
      ] as const) {
        if (approvals >= 2) break;
        try {
          await buildSignSubmit({
            action: "approve",
            walletId,
            userId: user,
            signers: [kp],
            step: `approve-w1-${kp.publicKey().slice(0, 4)}`,
          });
        } catch (err) {
          // AlreadyApproved (initiator được đếm sẵn) — hợp lệ, sang guardian kế.
          const code = err instanceof StellarServiceError ? contractErrorCode(err.message) : null;
          if (code !== "CONTRACT_ERROR:AlreadyApproved") throw err;
        }
        status = await readStatus(owner1.publicKey());
        approvals = (status.approvals as unknown[]).length;
      }
      expect(approvals).toBeGreaterThanOrEqual(2);

      // TIMELOCK THẬT: chờ tới khi contract báo hết (6s + lề block time).
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        const remaining = (await simulateRead({
          contractId: REGISTRY,
          method: "timelock_remaining",
          args: finalizeArgs({ wallet: owner1.publicKey() }),
        })) as bigint | number;
        if (Number(remaining) === 0) break;
        await new Promise((r) => setTimeout(r, 3_000));
      }

      const done = await finalizeRecovery(gateway, REGISTRY, {
        walletId,
        userId: OWNER1_USER,
      });
      txEvidence.push({ step: "finalize-w1", hash: done.hash });
      expect(done.status).toBe("SUCCESS");

      // Chủ mới THẬT trên chain = ứng viên đề cử.
      const config = (await simulateRead({
        contractId: REGISTRY,
        method: "get_wallet_config",
        args: finalizeArgs({ wallet: owner1.publicKey() }),
      })) as { owner: string };
      expect(config.owner).toBe(newOwner.publicKey());
    },
    240_000,
  );

  testIt(
    "luồng 3 — VETO KHẨN: initiate rồi owner chặn; approve sau đó CHẾT đúng mã contract",
    async () => {
      const walletId = await seedWalletRow({
        ownerUser: OWNER2_USER,
        address: owner2.publicKey(),
        timelockSecs: 3600, // timelock dài — veto phải chặn TRƯỚC khi hết
      });
      await buildSignSubmit({
        action: "register",
        walletId,
        userId: OWNER2_USER,
        signers: [owner2],
        step: "register-w2",
      });
      await buildSignSubmit({
        action: "initiate",
        walletId,
        userId: G1_USER,
        signers: [g1],
        newOwner: newOwner.publicKey(),
        step: "initiate-w2",
      });
      await buildSignSubmit({
        action: "veto",
        walletId,
        userId: OWNER2_USER,
        signers: [owner2],
        step: "veto-w2",
      });

      // Sau veto: approve phải bị contract từ chối bằng mã rõ ràng.
      const err = await buildSignSubmit({
        action: "approve",
        walletId,
        userId: G2_USER,
        signers: [g2],
        step: "approve-after-veto-w2",
      }).catch((e) => e);
      expect(err).toBeInstanceOf(StellarServiceError);
      const code = contractErrorCode((err as StellarServiceError).message) ?? "NO_CONTRACT_CODE";
      expect(["CONTRACT_ERROR:RecoveryCancelled", "CONTRACT_ERROR:NoActiveRecovery"]).toContain(
        code,
      );
    },
    240_000,
  );
});
