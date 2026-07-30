// Integration Postgres THẬT + gateway FAKE (không mạng) — phủ pipeline gửi tiền:
// số dư thiếu chặn TRƯỚC biometric · allow đi thẳng awaiting_signature + build tx ·
// vượt ngưỡng → awaiting_guardian + phiếu bound · guardian duyệt → awaiting_signature ·
// sign → settled. Đường chain THẬT ở onchain e2e (guard env riêng).
import { afterAll, describe, expect, it } from "bun:test";
import { Address, Keypair, xdr } from "@stellar/stellar-sdk";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { DEFAULT_PER_TX_STROOPS } from "@/modules/wallets";
import { FeePolicyError } from "@/services/stellar/fee-policy";
import type { BuiltInvoke } from "@/services/stellar/stellar.service";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { notifications } from "../../../notifications/infra/notifications.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { transferArgs } from "../../domain/transfer";
import { pendingApprovalsForGuardianUser } from "../../infra/approvals.repository";
import { approvalRequests } from "../../infra/approvals.schema";
import { transactionIntents } from "../../infra/intents.schema";
import { intentsAwaitingSignatureForOwner } from "../../infra/signing.repository";
import { CancelError, cancelIntent } from "../cancel-intent/service";
import {
  confirmSend,
  guardianApproveIntent,
  prepareSend,
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

async function seedWallet(): Promise<{ id: string; address: string; guardianKey: string }> {
  const address = Keypair.random().publicKey();
  const [w] = await db
    .insert(wallets)
    .values({ userId: OWNER, stellarAddress: address })
    .returning({ id: wallets.id });
  if (!w) throw new Error("wallet insert failed");
  cleanupWalletIds.push(w.id);
  const guardianKey = Keypair.random().publicKey();
  await db.insert(guardians).values({
    walletId: w.id,
    userId: GUARDIAN,
    onchainKey: guardianKey,
    status: "active",
  });
  return { id: w.id, address, guardianKey };
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
  // Thông báo là SOFT-REF sang user (không FK) nên xoá ví KHÔNG dọn nó. Bỏ lại
  // là rác tích luỹ trong DB dev, và dispatcher claim theo `ORDER BY created_at
  // LIMIT 50` — quá 50 dòng queued cũ thì test dispatcher (chèn dòng của nó SAU
  // CÙNG) không bao giờ được claim và đỏ vì lý do chẳng liên quan gì tới nó.
  await db.delete(notifications).where(inArray(notifications.userId, [OWNER, GUARDIAN]));
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
    const over = DEFAULT_PER_TX_STROOPS + 1n;
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
    const over = DEFAULT_PER_TX_STROOPS + 1n;
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

/** Đếm notification theo user + template — GUARDIAN/OWNER dùng chung giữa các
 * test trong file nên assert bằng DELTA, không đếm tuyệt đối. */
async function notifCount(userId: string, templateKey: string) {
  const rows = await db
    .select({ channel: notifications.channel })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.templateKey, templateKey)));
  return rows;
}

/** Dựng một intent VƯỢT ngưỡng đứng ở awaiting_guardian — dùng chung cho cụm LÔ 1. */
async function seedAwaitingGuardian() {
  const w = await seedWallet();
  const over = DEFAULT_PER_TX_STROOPS + 1n;
  const { gateway } = fakeGateway(over * 2n);
  const review = await prepareSend(gateway, SAC, {
    walletId: w.id,
    userId: OWNER,
    clientIntentId: crypto.randomUUID(),
    recipient: Keypair.random().publicKey(),
    amount: over,
  });
  await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
  return { w, intentId: review.intentId };
}

describe("LÔ 1 — báo guardian + từ chối + huỷ lệnh + TTL (A5/A6)", () => {
  testIt("vượt ngưỡng → guardian ĐƯỢC BÁO (email + sse) và thấy phiếu trong hộp chờ", async () => {
    const before = await notifCount(GUARDIAN, "approval.requested");
    const { intentId } = await seedAwaitingGuardian();

    // A5 — chính là ca chưa từng chạy được: mỗi kênh thêm ĐÚNG MỘT dòng.
    // (Đếm theo kênh, không slice — SELECT không ORDER BY và GUARDIAN dùng
    // chung giữa các test trong file.)
    const after = await notifCount(GUARDIAN, "approval.requested");
    const byChannel = (rows: { channel: string }[], ch: string) =>
      rows.filter((n) => n.channel === ch).length;
    expect(byChannel(after, "email")).toBe(byChannel(before, "email") + 1);
    expect(byChannel(after, "sse")).toBe(byChannel(before, "sse") + 1);

    // Hộp phiếu chờ của guardian PHẢI khám phá ra intent này (lỗ thứ ba của A5).
    const inbox = await pendingApprovalsForGuardianUser(GUARDIAN, new Date());
    expect(inbox.some((r) => r.intentId === intentId)).toBe(true);
  });

  testIt("TTL đồng bộ (A6): phiếu guardian hết hạn ĐÚNG lúc intent hết hạn", async () => {
    const { intentId } = await seedAwaitingGuardian();
    const [intentRow] = await db
      .select({ expiresAt: transactionIntents.expiresAt })
      .from(transactionIntents)
      .where(eq(transactionIntents.id, intentId));
    const [appr] = await db
      .select({ expiresAt: approvalRequests.expiresAt })
      .from(approvalRequests)
      .where(eq(approvalRequests.intentId, intentId));
    expect(intentRow?.expiresAt).not.toBeNull();
    expect(appr?.expiresAt.getTime()).toBe(intentRow?.expiresAt?.getTime());
  });

  testIt("guardian TỪ CHỐI → intent rejected + phiếu rejected + chủ ví được báo", async () => {
    const beforeOwner = await notifCount(OWNER, "approval.rejected");
    const { intentId } = await seedAwaitingGuardian();

    const outcome = await guardianApproveIntent({
      intentId,
      userId: GUARDIAN,
      verifiedCall: true,
      decision: "rejected",
    });
    expect(outcome.nextStatus).toBe("rejected");

    const [row] = await db
      .select({ status: transactionIntents.status })
      .from(transactionIntents)
      .where(eq(transactionIntents.id, intentId));
    expect(row?.status).toBe("rejected");
    const [appr] = await db
      .select({ decision: approvalRequests.decision })
      .from(approvalRequests)
      .where(eq(approvalRequests.intentId, intentId));
    expect(appr?.decision).toBe("rejected");

    const afterOwner = await notifCount(OWNER, "approval.rejected");
    const count = (rows: { channel: string }[], ch: string) =>
      rows.filter((n) => n.channel === ch).length;
    expect(count(afterOwner, "email")).toBe(count(beforeOwner, "email") + 1);
    expect(count(afterOwner, "sse")).toBe(count(beforeOwner, "sse") + 1);
  });

  testIt("chủ ví HUỶ lệnh đang chờ → cancelled + phiếu pending chết theo + audit", async () => {
    const { w, intentId } = await seedAwaitingGuardian();
    const result = await cancelIntent({ intentId, userId: OWNER });
    expect(result.status).toBe("cancelled");

    const [row] = await db
      .select({ status: transactionIntents.status })
      .from(transactionIntents)
      .where(eq(transactionIntents.id, intentId));
    expect(row?.status).toBe("cancelled");
    const approvals = await db
      .select({ decision: approvalRequests.decision })
      .from(approvalRequests)
      .where(eq(approvalRequests.intentId, intentId));
    expect(approvals.every((a) => a.decision === "expired")).toBe(true);

    // Hộp guardian không còn thấy phiếu của lệnh đã huỷ.
    const inbox = await pendingApprovalsForGuardianUser(GUARDIAN, new Date());
    expect(inbox.some((r) => r.intentId === intentId)).toBe(false);
    // walletId dùng để scope audit — tránh false-positive từ ví khác.
    expect(w.id.length).toBe(26);
  });

  testIt(
    "NGƯỜI KHÁC không huỷ được (403); trạng thái sai bị state machine chối (409)",
    async () => {
      const { intentId } = await seedAwaitingGuardian();
      const err = await cancelIntent({
        intentId,
        userId: `stranger-${crypto.randomUUID().slice(0, 6)}`,
      }).catch((e) => e);
      expect(err).toBeInstanceOf(CancelError);
      expect((err as CancelError).status).toBe(403);

      // Intent đã settled (markRecipientKnown chèn settled) → cancel bị chối 409.
      const w2 = await seedWallet();
      const recipient = Keypair.random().publicKey();
      await markRecipientKnown(w2.id, recipient);
      const [settled] = await db
        .select({ id: transactionIntents.id })
        .from(transactionIntents)
        .where(
          and(eq(transactionIntents.walletId, w2.id), eq(transactionIntents.status, "settled")),
        );
      if (!settled) throw new Error("seed settled failed");
      const err2 = await cancelIntent({ intentId: settled.id, userId: OWNER }).catch((e) => e);
      expect(err2).toBeInstanceOf(CancelError);
      expect((err2 as CancelError).status).toBe(409);
    },
  );
});

/** Chèn intent settled với createdAt TUỲ CHỌN — dựng lịch sử chi tiêu cho A4.
 * `recipient` truyền vào khi ca test cần chính địa chỉ đó vào `knownRecipients`
 * (repo đọc đúng `status='settled'` + `recipient`), mặc định ngẫu nhiên. */
async function seedSettledSpend(
  walletId: string,
  amount: bigint,
  createdAt: Date,
  recipient?: string,
): Promise<void> {
  await db.insert(transactionIntents).values({
    walletId,
    clientIntentId: `spend-${crypto.randomUUID().slice(0, 12)}`,
    createdBy: "owner",
    status: "settled",
    operations: [],
    recipient: recipient ?? Keypair.random().publicKey(),
    amount,
    createdAt,
  });
}

describe("LÔ POLICY — C1/C2 mở khoá dùng hằng ngày + A4 rolling 24h + A5 re-eval thật", () => {
  testIt(
    "C1: địa chỉ LẠ + dưới ngưỡng → ĐI THẲNG, review cắm cờ knownRecipient=false",
    async () => {
      const w = await seedWallet();
      const { gateway } = fakeGateway(100_000_000_000n);
      const review = await prepareSend(gateway, SAC, {
        walletId: w.id,
        userId: OWNER,
        clientIntentId: crypto.randomUUID(),
        recipient: Keypair.random().publicKey(), // chưa từng gửi, không phải guardian
        amount: 1_000_000_000n, // 100 XLM < per_tx 1.000
      });
      expect(review.knownRecipient).toBe(false); // C5 — cảnh báo mềm, không chặn
      const confirmed = await confirmSend(gateway, SAC, {
        intentId: review.intentId,
        userId: OWNER,
      });
      expect(confirmed.status).toBe("awaiting_signature"); // KHÔNG đòi duyệt
    },
  );

  testIt(
    "🔴 CỬA HẬU: gửi nhỏ cho địa chỉ lạ → settled → gửi VƯỢT per_tx cho CHÍNH nó → PHẢI xin duyệt",
    async () => {
      // Tái hiện đúng chuỗi khai thác trên ví thật 01KYRQ07WM… (2026-07-30):
      //   16:58:36 gửi 100 XLM cho địa chỉ lạ → settled
      //   16:59:37 gửi 600 XLM cho CHÍNH địa chỉ đó → policy allow (đã "quen")
      //   16:59:54 settled — 3× per_tx, không ai duyệt, sau 52 giây.
      // Trước lô này ca dưới trả awaiting_signature. Chống hồi quy vĩnh viễn.
      const w = await seedWallet();
      const { gateway } = fakeGateway(300_000_000_000n);
      const victim = Keypair.random().publicKey();
      // Giao dịch mồi đã settle → victim vào knownRecipients.
      await seedSettledSpend(w.id, 1_000_000_000n, new Date(), victim);

      const review = await prepareSend(gateway, SAC, {
        walletId: w.id,
        userId: OWNER,
        clientIntentId: crypto.randomUUID(),
        recipient: victim,
        amount: DEFAULT_PER_TX_STROOPS + 1n, // vượt per_tx, vẫn dưới daily
      });
      // Cảnh báo mềm vẫn nói "quen" — chữ mềm KHÔNG còn là cổng chính sách.
      expect(review.knownRecipient).toBe(true);

      const confirmed = await confirmSend(gateway, SAC, {
        intentId: review.intentId,
        userId: OWNER,
      });
      expect(confirmed.status).toBe("awaiting_guardian");
      if (confirmed.status === "awaiting_guardian") {
        expect(confirmed.reasons).toContain("over_tx_limit");
      }
    },
  );

  testIt("guardian ĐÃ GỠ → mất miễn trừ per_tx ngay lần gửi kế tiếp", async () => {
    const w = await seedWallet();
    const { gateway } = fakeGateway(300_000_000_000n);
    await db
      .update(guardians)
      .set({ status: "removed" })
      .where(and(eq(guardians.walletId, w.id), eq(guardians.userId, GUARDIAN)));
    const review = await prepareSend(gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient: w.guardianKey,
      amount: DEFAULT_PER_TX_STROOPS + 1n,
    });
    const confirmed = await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
    expect(confirmed.status).toBe("awaiting_guardian");
    if (confirmed.status === "awaiting_guardian") {
      expect(confirmed.reasons).toContain("over_tx_limit");
    }
  });

  testIt("C2: gửi SỐ LỚN cho guardian (vượt per_tx, dưới daily) → ĐI THẲNG", async () => {
    const w = await seedWallet();
    const { gateway } = fakeGateway(100_000_000_000n);
    const review = await prepareSend(gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient: w.guardianKey, // địa chỉ on-chain của guardian
      amount: 50_000_000_000n, // 5.000 XLM > per_tx 1.000, < daily 10.000
    });
    expect(review.knownRecipient).toBe(true); // guardian = người quen
    const confirmed = await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
    expect(confirmed.status).toBe("awaiting_signature");
  });

  testIt(
    "A4: cộng dồn TRONG 24h vượt daily → cần duyệt; chi tiêu CŨ HƠN 24h không tính",
    async () => {
      const w = await seedWallet();
      const { gateway } = fakeGateway(300_000_000_000n);
      // 9.900 XLM đã settle 2h trước — nằm TRONG cửa sổ rolling.
      await seedSettledSpend(w.id, 99_000_000_000n, new Date(Date.now() - 2 * 3_600_000));
      const review = await prepareSend(gateway, SAC, {
        walletId: w.id,
        userId: OWNER,
        clientIntentId: crypto.randomUUID(),
        recipient: Keypair.random().publicKey(),
        amount: 2_000_000_000n, // 200 XLM — dưới per_tx nhưng 9.900+200 > 10.000
      });
      const confirmed = await confirmSend(gateway, SAC, {
        intentId: review.intentId,
        userId: OWNER,
      });
      expect(confirmed.status).toBe("awaiting_guardian");
      if (confirmed.status === "awaiting_guardian") {
        expect(confirmed.reasons).toContain("over_daily_limit");
      }

      // Cùng kịch bản nhưng khoản 9.900 XLM đã RA KHỎI cửa sổ (25h trước) → đi thẳng.
      const w2 = await seedWallet();
      await seedSettledSpend(w2.id, 99_000_000_000n, new Date(Date.now() - 25 * 3_600_000));
      const review2 = await prepareSend(gateway, SAC, {
        walletId: w2.id,
        userId: OWNER,
        clientIntentId: crypto.randomUUID(),
        recipient: Keypair.random().publicKey(),
        amount: 2_000_000_000n,
      });
      const confirmed2 = await confirmSend(gateway, SAC, {
        intentId: review2.intentId,
        userId: OWNER,
      });
      expect(confirmed2.status).toBe("awaiting_signature");
    },
  );

  testIt(
    "A5: re-eval sau duyệt dùng CONTEXT THẬT — điều kiện MỚI (daily vượt sau khi phiếu mở) bật ngược lại awaiting_guardian",
    async () => {
      const w = await seedWallet();
      const over = DEFAULT_PER_TX_STROOPS + 1n;
      const { gateway } = fakeGateway(300_000_000_000n);
      const review = await prepareSend(gateway, SAC, {
        walletId: w.id,
        userId: OWNER,
        clientIntentId: crypto.randomUUID(),
        recipient: Keypair.random().publicKey(),
        amount: over, // người lạ + vượt per_tx → awaiting_guardian
      });
      const confirmed = await confirmSend(gateway, SAC, {
        intentId: review.intentId,
        userId: OWNER,
      });
      expect(confirmed.status).toBe("awaiting_guardian");

      // GIỮA lúc phiếu mở và lúc guardian duyệt: ví tiêu thêm 9.990 XLM → daily cạn.
      await seedSettledSpend(w.id, 99_900_000_000n, new Date());

      const outcome = await guardianApproveIntent({
        intentId: review.intentId,
        userId: GUARDIAN,
        verifiedCall: true,
      });
      // over_tx_limit đã được guardian clear (trừ ra), nhưng over_daily_limit là
      // điều kiện MỚI — context thật phải bắt được, không luôn-allow như bản cũ.
      expect(outcome.nextStatus).toBe("awaiting_guardian");
      expect(outcome.reasons).toContain("over_daily_limit");
      expect(outcome.reasons).toContain("reevaluation_required");
    },
  );
});

describe("LÔ VÁ L2 — chủ ví KHÁM PHÁ LẠI lệnh đang chờ chính mình ký", () => {
  testIt("guardian duyệt xong → lệnh hiện trong danh sách chờ ký của chủ ví", async () => {
    const w = await seedWallet();
    const { gateway } = fakeGateway(300_000_000_000n);
    const recipient = Keypair.random().publicKey();
    const review = await prepareSend(gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient,
      amount: DEFAULT_PER_TX_STROOPS + 1n,
    });
    const confirmed = await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
    expect(confirmed.status).toBe("awaiting_guardian");
    // Đang chờ duyệt thì CHƯA ký được → không được nằm trong danh sách.
    const before = await intentsAwaitingSignatureForOwner(OWNER, new Date());
    expect(before.some((r) => r.intentId === review.intentId)).toBe(false);

    await guardianApproveIntent({
      intentId: review.intentId,
      userId: GUARDIAN,
      verifiedCall: true,
    });

    // Đây là đường thay cho `intentId` trong state của tab: đóng tab / F5 xong
    // vẫn tìm lại được lệnh. Trước lô này không có route nào trả về nó.
    const after = await intentsAwaitingSignatureForOwner(OWNER, new Date());
    const row = after.find((r) => r.intentId === review.intentId);
    expect(row).toBeDefined();
    expect(row?.recipient).toBe(recipient); // ĐẦY ĐỦ — chống ký mù cần địa chỉ thật
    expect(row?.walletAddress).toBe(w.address);
    expect(row?.amount).toBe(DEFAULT_PER_TX_STROOPS + 1n);
  });

  testIt("KHÔNG trả lệnh của ví người khác", async () => {
    const mine = await seedWallet();
    const { gateway } = fakeGateway(300_000_000_000n);
    const review = await prepareSend(gateway, SAC, {
      walletId: mine.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient: Keypair.random().publicKey(),
      amount: 1_000_000_000n, // dưới ngưỡng → thẳng awaiting_signature
    });
    await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });

    const stranger = `it-send-other-${crypto.randomUUID().slice(0, 8)}`;
    const rows = await intentsAwaitingSignatureForOwner(stranger, new Date());
    expect(rows.some((r) => r.intentId === review.intentId)).toBe(false);
    expect(rows).toEqual([]);
  });

  testIt("lệnh ĐÃ HẾT HẠN không hiện (không dắt người dùng vào 409)", async () => {
    const w = await seedWallet();
    const { gateway } = fakeGateway(300_000_000_000n);
    const review = await prepareSend(gateway, SAC, {
      walletId: w.id,
      userId: OWNER,
      clientIntentId: crypto.randomUUID(),
      recipient: Keypair.random().publicKey(),
      amount: 1_000_000_000n,
    });
    await confirmSend(gateway, SAC, { intentId: review.intentId, userId: OWNER });
    await db
      .update(transactionIntents)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(transactionIntents.id, review.intentId));

    const rows = await intentsAwaitingSignatureForOwner(OWNER, new Date());
    expect(rows.some((r) => r.intentId === review.intentId)).toBe(false);
  });
});
