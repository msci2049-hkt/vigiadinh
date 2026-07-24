// Integration Postgres THẬT + gateway FAKE (không mạng) — phủ gate BE của 5.2:
// vai trò đúng mới build được, submit chỉ nhận entry whitelist, audit ghi actor thật.
// Đường chain THẬT nằm ở onchain.e2e.test.ts (guard env riêng).
import { afterAll, describe, expect, it } from "bun:test";
import { Address, Keypair, xdr } from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import type { BuiltInvoke } from "@/services/stellar/stellar.service";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { auditLog } from "../../../indexer/infra/audit-log.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { approveArgs, RECOVERY_METHODS } from "../../domain/onchain";
import {
  buildRecoveryAction,
  finalizeRecovery,
  type OnchainGateway,
  RecoveryActionError,
  submitRecoveryAction,
} from "./service";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const REGISTRY = "CCPGVSLRFSUOGRFH3LAOWXSHJ2Y3QBFEA2ZTV4PWIINVGJWVDFA5GT3V";
const OWNER_USER = `it-owner-${crypto.randomUUID().slice(0, 8)}`;
const GUARDIAN_USER = `it-guard-${crypto.randomUUID().slice(0, 8)}`;
const STRANGER = `it-stranger-${crypto.randomUUID().slice(0, 8)}`;

const walletKey = Keypair.random().publicKey();
const guardianKey = Keypair.random().publicKey();
const cleanupWalletIds: string[] = [];

async function seedWallet(opts?: { guardianOnchainKey?: string | null }): Promise<string> {
  const [w] = await db
    .insert(wallets)
    .values({ userId: OWNER_USER, stellarAddress: Keypair.random().publicKey() })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  await db.insert(guardians).values({
    walletId: w.id,
    userId: GUARDIAN_USER,
    onchainKey: opts?.guardianOnchainKey === undefined ? guardianKey : opts.guardianOnchainKey,
    status: "active",
  });
  return w.id;
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade dọn guardians
  }
});

/** Gateway fake ghi lại lời gọi — không chạm mạng. */
function fakeGateway(overrides?: Partial<OnchainGateway>) {
  const calls: { build: Array<{ method: string }>; invoke: Array<{ method: string }> } = {
    build: [],
    invoke: [],
  };
  const built: BuiltInvoke = { transactionXdr: "tx", authEntriesXdr: [], latestLedger: 1 };
  const gateway: OnchainGateway = {
    async build(input) {
      calls.build.push({ method: input.method });
      return built;
    },
    async invoke(input) {
      calls.invoke.push({ method: input.method });
      return { hash: "h".repeat(64), status: "SUCCESS" };
    },
    async read() {
      return { owner: walletKey, guardians: [guardianKey], threshold: 2, timelock_secs: 60 };
    },
    ...overrides,
  };
  return { gateway, calls };
}

function signedApproveEntry(walletAddress: string): string {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(guardianKey).toScAddress(),
        nonce: new xdr.Int64(1n),
        signatureExpirationLedger: 1000,
        signature: xdr.ScVal.scvVec([]),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(REGISTRY).toScAddress(),
          functionName: RECOVERY_METHODS.approve,
          args: approveArgs({ wallet: walletAddress, guardian: guardianKey }),
        }),
      ),
      subInvocations: [],
    }),
  }).toXDR("base64");
}

describe("recovery onchain service (DB thật + gateway fake)", () => {
  testIt("initiate: guardian build được, initiator = onchainKey từ DB", async () => {
    const walletId = await seedWallet();
    const { gateway, calls } = fakeGateway();
    const result = await buildRecoveryAction(gateway, REGISTRY, {
      action: "initiate",
      walletId,
      userId: GUARDIAN_USER,
      newOwner: Keypair.random().publicKey(),
    });
    expect(result.action).toBe("initiate");
    expect(calls.build[0]?.method).toBe("initiate_recovery");
  });

  testIt("initiate: NGƯỜI LẠ → 403 NOT_GUARDIAN (chủ ví cũng không initiate được)", async () => {
    const walletId = await seedWallet();
    const { gateway } = fakeGateway();
    for (const userId of [STRANGER, OWNER_USER]) {
      const err = await buildRecoveryAction(gateway, REGISTRY, {
        action: "initiate",
        walletId,
        userId,
        newOwner: Keypair.random().publicKey(),
      }).catch((e) => e);
      expect(err).toBeInstanceOf(RecoveryActionError);
      expect((err as RecoveryActionError).status).toBe(403);
    }
  });

  testIt("initiate thiếu new_owner → 400; guardian chưa có khoá on-chain → 409", async () => {
    const noNewOwner = await buildRecoveryAction(fakeGateway().gateway, REGISTRY, {
      action: "initiate",
      walletId: await seedWallet(),
      userId: GUARDIAN_USER,
    }).catch((e) => e);
    expect((noNewOwner as RecoveryActionError).status).toBe(400);

    const keyless = await buildRecoveryAction(fakeGateway().gateway, REGISTRY, {
      action: "initiate",
      walletId: await seedWallet({ guardianOnchainKey: null }),
      userId: GUARDIAN_USER,
      newOwner: Keypair.random().publicKey(),
    }).catch((e) => e);
    expect((keyless as RecoveryActionError).status).toBe(409);
  });

  testIt("veto: CHỈ chủ ví; owner arg lấy từ get_wallet_config trên chain", async () => {
    const walletId = await seedWallet();
    let readCalled = false;
    const { gateway, calls } = fakeGateway({
      async read() {
        readCalled = true;
        return { owner: walletKey, guardians: [], threshold: 2, timelock_secs: 60 };
      },
    });
    await buildRecoveryAction(gateway, REGISTRY, { action: "veto", walletId, userId: OWNER_USER });
    expect(readCalled).toBe(true);
    expect(calls.build[0]?.method).toBe("cancel_recovery");

    const err = await buildRecoveryAction(gateway, REGISTRY, {
      action: "veto",
      walletId,
      userId: GUARDIAN_USER,
    }).catch((e) => e);
    expect((err as RecoveryActionError).status).toBe(403);
  });

  testIt("register: dưới 2 khoá guardian → 409 (contract cũng chặn, BE chặn sớm)", async () => {
    const walletId = await seedWallet(); // chỉ 1 guardian
    const err = await buildRecoveryAction(fakeGateway().gateway, REGISTRY, {
      action: "register",
      walletId,
      userId: OWNER_USER,
    }).catch((e) => e);
    expect((err as RecoveryActionError).status).toBe(409);
  });

  testIt("submit: thành viên ví nộp entry hợp lệ → invoke + audit actor thật", async () => {
    const walletId = await seedWallet();
    const [w] = await db.select().from(wallets).where(eq(wallets.id, walletId));
    if (!w) throw new Error("wallet missing");
    const { gateway, calls } = fakeGateway();
    const result = await submitRecoveryAction(gateway, REGISTRY, {
      walletId,
      userId: GUARDIAN_USER,
      signedEntriesXdr: [signedApproveEntry(w.stellarAddress)],
    });
    expect(result.status).toBe("SUCCESS");
    expect(calls.invoke[0]?.method).toBe("approve_recovery");
    const audits = await db.select().from(auditLog).where(eq(auditLog.walletId, walletId));
    expect(
      audits.some((a) => a.kind === "recovery.onchain.submitted" && a.actorType === "guardian"),
    ).toBe(true);
  });

  testIt("submit: người ngoài ví → 403, KHÔNG chạm gateway", async () => {
    const walletId = await seedWallet();
    const [w] = await db.select().from(wallets).where(eq(wallets.id, walletId));
    if (!w) throw new Error("wallet missing");
    const { gateway, calls } = fakeGateway();
    const err = await submitRecoveryAction(gateway, REGISTRY, {
      walletId,
      userId: STRANGER,
      signedEntriesXdr: [signedApproveEntry(w.stellarAddress)],
    }).catch((e) => e);
    expect((err as RecoveryActionError).status).toBe(403);
    expect(calls.invoke).toHaveLength(0);
  });

  testIt("finalize: one-shot khi sim không đòi auth; đòi auth → 409 dừng", async () => {
    const walletId = await seedWallet();
    const ok = await finalizeRecovery(fakeGateway().gateway, REGISTRY, {
      walletId,
      userId: OWNER_USER,
    });
    expect(ok.method).toBe("finalize_recovery");

    const { gateway } = fakeGateway({
      async build() {
        return { transactionXdr: "tx", authEntriesXdr: ["entry"], latestLedger: 1 };
      },
    });
    const err = await finalizeRecovery(gateway, REGISTRY, {
      walletId,
      userId: OWNER_USER,
    }).catch((e) => e);
    expect((err as RecoveryActionError).message).toBe("FINALIZE_REQUIRES_AUTH_UNEXPECTED");
  });
});
