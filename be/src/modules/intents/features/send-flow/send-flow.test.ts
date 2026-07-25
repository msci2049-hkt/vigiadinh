// Integration Postgres THẬT + gateway FAKE (không mạng) — phủ pipeline gửi tiền:
// số dư thiếu chặn TRƯỚC biometric · allow đi thẳng awaiting_signature + build tx ·
// vượt ngưỡng → awaiting_guardian + phiếu bound · guardian duyệt → awaiting_signature ·
// sign → settled. Đường chain THẬT ở onchain e2e (guard env riêng).
import { afterAll, describe, expect, it } from "bun:test";
import { Address, Keypair, xdr } from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { FeePolicyError } from "@/services/stellar/fee-policy";
import type { BuiltInvoke } from "@/services/stellar/stellar.service";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { transferArgs } from "../../domain/transfer";
import { approvalRequests } from "../../infra/approvals.schema";
import { transactionIntents } from "../../infra/intents.schema";
import {
  confirmSend,
  guardianApproveIntent,
  prepareSend,
  SEND_PER_TX_LIMIT_STROOPS,
  type SendGateway,
  SendServiceError,
  signAndSubmit,
} from "./service";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
/** Registry giả — chỉ để cổng ví phí có chỗ hỏi `is_registered` (fake trả lời). */
const REGISTRY = "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFI5FSFZ4KZTQBMPXOA";
const OWNER = `it-send-owner-${crypto.randomUUID().slice(0, 8)}`;
const GUARDIAN = `it-send-guard-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];

async function seedWallet(): Promise<{ id: string; address: string }> {
  const address = Keypair.random().publicKey();
  const [w] = await db
    .insert(wallets)
    .values({ userId: OWNER, stellarAddress: address })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  await db.insert(guardians).values({
    walletId: w.id,
    userId: GUARDIAN,
    onchainKey: Keypair.random().publicKey(),
    status: "active",
  });
  return { id: w.id, address };
}

/**
 * Gateway fake — balance cấu hình được; build/invoke ghi lại lời gọi.
 *
 * `read` phải phân biệt THEO METHOD kể từ closeout B-SEC-3: cổng ví phí đọc
 * `is_registered` trên registry, còn luồng gửi đọc `balance` trên SAC. Bản cũ trả
 * `balance` cho mọi method — nghĩa là cổng sponsorship sẽ nhận một `bigint` thay vì
 * `true` và chối sạch. `registered` mặc định `true` để mọi test cũ giữ nguyên ý nghĩa.
 */
function fakeGateway(balance: bigint, opts?: { registered?: boolean }) {
  const calls = { build: 0, invoke: 0 };
  const built: BuiltInvoke = { transactionXdr: "tx", authEntriesXdr: ["e"], latestLedger: 1 };
  const gateway: SendGateway = {
    async build() {
      calls.build++;
      return built;
    },
    async invoke() {
      calls.invoke++;
      return { hash: "h".repeat(64), status: "SUCCESS" };
    },
    async read(input: { contractId: string; method: string }) {
      if (input.method === "is_registered") return opts?.registered ?? true;
      return balance;
    },
  };
  return { gateway, calls };
}

// Entry phải chở ĐÚNG người nhận + số tiền của intent — bản cũ nhét địa chỉ
// ngẫu nhiên và 100n, tức là test đã vô tình khẳng định chính lỗ hổng P0-6
// (nộp entry khác hẳn intent vẫn qua).
function signedEntry(walletAddress: string, to: string, amount: bigint): string {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(walletAddress).toScAddress(),
        nonce: new xdr.Int64(1n),
        signatureExpirationLedger: 1000,
        signature: xdr.ScVal.scvVec([]),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(SAC).toScAddress(),
          functionName: "transfer",
          args: transferArgs({ from: walletAddress, to, amount }),
        }),
      ),
      subInvocations: [],
    }),
  }).toXDR("base64");
}

/** Đánh dấu recipient ĐÃ BIẾT: chèn MỘT intent settled tới địa chỉ đó (policy v1
 * coi người từng gửi settled là known → allow; người lạ luôn require_guardian). */
async function markRecipientKnown(walletId: string, recipient: string): Promise<void> {
  await db.insert(transactionIntents).values({
    walletId,
    clientIntentId: `seed-${crypto.randomUUID().slice(0, 12)}`,
    createdBy: "owner",
    status: "settled",
    operations: [],
    recipient,
    amount: 1n,
  });
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) await db.delete(wallets).where(eq(wallets.id, id));
});

describe("send flow (DB thật + gateway fake)", () => {
  testIt("số dư THIẾU → chặn ở prepare, KHÔNG sang review (trước biometric)", async () => {
    const w = await seedWallet();
    const err = await prepareSend(fakeGateway(50n).gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient: Keypair.random().publicKey(),
      amount: 100n,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(SendServiceError);
    expect((err as SendServiceError).message).toBe("INSUFFICIENT_BALANCE");
    expect((err as SendServiceError).detail?.shortfall).toBe("50");
    const [row] = await db
      .select({ status: transactionIntents.status })
      .from(transactionIntents)
      .where(eq(transactionIntents.walletId, w.id));
    expect(row?.status).toBe("validating"); // đứng ở validating, không review
  });

  testIt(
    "dưới ngưỡng + người nhận ĐÃ BIẾT + đủ dư → allow → awaiting_signature + build tx",
    async () => {
      const w = await seedWallet();
      const recipient = Keypair.random().publicKey();
      await markRecipientKnown(w.id, recipient);
      const { gateway, calls } = fakeGateway(10_000_000_000n);
      const review = await prepareSend(gateway, SAC, {
        walletId: w.id,
        userId: OWNER,
        clientIntentId: crypto.randomUUID(),
        recipient,
        amount: 5_000_000n,
      });
      expect(review.status).toBe("review");
      const confirmed = await confirmSend(gateway, SAC, {
        intentId: review.intentId,
        userId: OWNER,
      });
      expect(confirmed.status).toBe("awaiting_signature");
      expect(calls.build).toBe(1);
      if (confirmed.status === "awaiting_signature") {
        expect(confirmed.authEntriesXdr.length).toBeGreaterThan(0);
      }
    },
  );

  testIt("VƯỢT ngưỡng → awaiting_guardian + phiếu duyệt bound; KHÔNG build tx", async () => {
    const w = await seedWallet();
    const over = SEND_PER_TX_LIMIT_STROOPS + 1n;
    const { gateway, calls } = fakeGateway(over + 1_000_000n);
    const review = await prepareSend(gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient: Keypair.random().publicKey(),
      amount: over,
    });
    const confirmed = await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
    expect(confirmed.status).toBe("awaiting_guardian");
    expect(calls.build).toBe(0); // chưa build tx ký được khi chờ guardian
    const approvals = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.intentId, review.intentId));
    expect(approvals.length).toBeGreaterThanOrEqual(1);
    expect(approvals[0]?.challengeHash.length).toBe(64);

    // Guardian duyệt (đã gọi xác minh) → intent sang awaiting_signature.
    const outcome = await guardianApproveIntent({
      intentId: review.intentId,
      userId: GUARDIAN,
      verifiedCall: true,
    });
    expect(outcome.nextStatus).toBe("awaiting_signature");
    const [row] = await db
      .select({ status: transactionIntents.status })
      .from(transactionIntents)
      .where(eq(transactionIntents.id, review.intentId));
    expect(row?.status).toBe("awaiting_signature");
  });

  testIt("người KHÔNG phải guardian của intent → 403", async () => {
    const w = await seedWallet();
    const over = SEND_PER_TX_LIMIT_STROOPS + 1n;
    const review = await prepareSend(fakeGateway(over + 1n).gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient: Keypair.random().publicKey(),
      amount: over,
    });
    await confirmSend(fakeGateway(over + 1n).gateway, SAC, {
      intentId: review.intentId,
      userId: OWNER,
    });
    const err = await guardianApproveIntent({
      intentId: review.intentId,
      userId: `stranger-${crypto.randomUUID().slice(0, 6)}`,
      verifiedCall: true,
    }).catch((e) => e);
    expect((err as SendServiceError).status).toBe(403);
  });

  testIt("sign allow-path → validate entry + invoke + settled", async () => {
    const w = await seedWallet();
    const recipient = Keypair.random().publicKey();
    await markRecipientKnown(w.id, recipient);
    const { gateway } = fakeGateway(10_000_000_000n);
    const review = await prepareSend(gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient,
      amount: 5_000_000n,
    });
    await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
    const result = await signAndSubmit(gateway, SAC, REGISTRY, {
      intentId: review.intentId,
      userId: OWNER,
      signedEntriesXdr: [signedEntry(w.address, recipient, 5_000_000n)],
    });
    expect(result.status).toBe("settled");
    expect(result.hash.length).toBe(64);
    const [row] = await db
      .select({ status: transactionIntents.status })
      .from(transactionIntents)
      .where(eq(transactionIntents.id, review.intentId));
    expect(row?.status).toBe("settled");
  });

  // B-SEC-3 hàng rào 1 — CA ÂM, và ca âm là ca quan trọng ở đây: whitelist
  // contract+method đã xanh từ đợt 1, nhưng nó chỉ nói "tx đúng hình dạng". Nếu
  // thiếu cổng `is_registered` thì bất kỳ tài khoản app nào cũng tạo ví C… rồi bơm
  // entry hợp-hình-dạng cho tới khi ví phí cạn — và ví phí cạn là MỌI hộ mất đường
  // ghi on-chain, kể cả recovery đang chạy.
  testIt("sign của ví CHƯA đăng ký → 403 và ví phí không ký gì", async () => {
    const w = await seedWallet();
    const recipient = Keypair.random().publicKey();
    await markRecipientKnown(w.id, recipient);
    const { gateway, calls } = fakeGateway(10_000_000_000n, { registered: false });
    const review = await prepareSend(gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient,
      amount: 5_000_000n,
    });
    await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
    const invokesBefore = calls.invoke;

    const err = await signAndSubmit(gateway, SAC, REGISTRY, {
      intentId: review.intentId,
      userId: OWNER,
      signedEntriesXdr: [signedEntry(w.address, recipient, 5_000_000n)],
    }).catch((e) => e);

    expect(err).toBeInstanceOf(FeePolicyError);
    expect((err as FeePolicyError).status).toBe(403);
    expect((err as FeePolicyError).message).toBe("WALLET_NOT_REGISTERED_FOR_SPONSORSHIP");
    // "Số dư ví phí KHÔNG đổi" trong test hermetic = ví phí chưa hề được gọi để ký/
    // submit. Không có mạng ở đây nên đây là bằng chứng tương đương mạnh nhất; số dư
    // thật chỉ chứng minh được ở e2e testnet (§7).
    expect(calls.invoke).toBe(invokesBefore);
    // Và intent phải còn ký lại được sau khi đăng ký — chối KHÔNG được đẩy nó vào
    // ngõ cụt `submitting`/`submit_failed`.
    const [row] = await db
      .select({ status: transactionIntents.status })
      .from(transactionIntents)
      .where(eq(transactionIntents.id, review.intentId));
    expect(row?.status).toBe("awaiting_signature");
  });
});
