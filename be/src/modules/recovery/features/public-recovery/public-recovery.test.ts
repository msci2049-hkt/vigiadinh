// Luồng public: fingerprint vector CHÉO NGÔN NGỮ (pin trùng cargo test) +
// integration Postgres cho device-request (supersede, scoping guardian) và
// progress public (shape vô hại, ví lạ = "none" không phân biệt được).
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";
import { guardians } from "../../../guardians/infra/guardians.schema";
import { wallets } from "../../../wallets/infra/wallets.schema";
import { recoveryDeviceRequests } from "../../infra/device-requests.schema";
import { openDeviceRequestsForGuardianUser } from "../../infra/guardian-inbox.repository";
import {
  publicProgressByAddress,
  upsertDeviceRequest,
  walletByStellarAddress,
} from "../../infra/recovery.repository";
import { recoveryRequests } from "../../infra/recovery-requests.schema";
import { signerFingerprintHex } from "./handler";

const dbUp = await pgReachable();
const testIt = dbUp ? it : it.skip;
if (!dbUp) console.warn(SKIP_REASON);

const VERIFIER = "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT";
const GUARDIAN_USER = `it-pr-guard-${crypto.randomUUID().slice(0, 8)}`;
const cleanupWalletIds: string[] = [];

function randomAddress(): string {
  return `C${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 55).padEnd(55, "B")}`;
}

afterAll(async () => {
  if (!dbUp) return;
  for (const id of cleanupWalletIds) {
    await db.delete(wallets).where(eq(wallets.id, id)); // cascade dọn hết bảng con
  }
});

describe("signerFingerprintHex — vector chéo ngôn ngữ", () => {
  it("TRÙNG từng byte với contract (cargo test signer_fingerprint_cross_language_vector)", () => {
    const fp = signerFingerprintHex({
      verifier: VERIFIER,
      keyBase64: Buffer.alloc(32, 7).toString("base64"),
    });
    expect(fp).toBe("cdc9947d62f44d6d81d4a532ce36da82c95465da589777c51ffdb5f9b0cda94e");
  });

  it("khoá khác → fingerprint khác", () => {
    const a = signerFingerprintHex({
      verifier: VERIFIER,
      keyBase64: Buffer.alloc(32, 7).toString("base64"),
    });
    const b = signerFingerprintHex({
      verifier: VERIFIER,
      keyBase64: Buffer.alloc(32, 8).toString("base64"),
    });
    expect(a).not.toBe(b);
  });
});

describe("device-request (DB thật)", () => {
  testIt("upsert đè request cũ (superseded) — mỗi ví MỘT request mở", async () => {
    const address = randomAddress();
    const [w] = await db
      .insert(wallets)
      .values({ userId: "it-pr-owner", stellarAddress: address })
      .returning({ id: wallets.id });
    if (!w) throw new Error("wallet insert failed");
    cleanupWalletIds.push(w.id);
    await db.insert(guardians).values({ walletId: w.id, userId: GUARDIAN_USER, status: "active" });

    expect((await walletByStellarAddress(address))?.id).toBe(w.id);

    const key1 = Buffer.alloc(32, 1).toString("base64");
    const key2 = Buffer.alloc(32, 2).toString("base64");
    await upsertDeviceRequest({
      walletId: w.id,
      verifier: VERIFIER,
      keyBase64: key1,
      fingerprint: signerFingerprintHex({ verifier: VERIFIER, keyBase64: key1 }),
    });
    await upsertDeviceRequest({
      walletId: w.id,
      verifier: VERIFIER,
      keyBase64: key2,
      fingerprint: signerFingerprintHex({ verifier: VERIFIER, keyBase64: key2 }),
    });

    const rows = await db
      .select()
      .from(recoveryDeviceRequests)
      .where(eq(recoveryDeviceRequests.walletId, w.id));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === "open")).toHaveLength(1);
    expect(rows.find((r) => r.status === "open")?.keyBase64).toBe(key2);

    // Guardian thấy đúng MỘT request mở, kèm địa chỉ ví (đối chiếu ngoài băng).
    const inbox = await openDeviceRequestsForGuardianUser(GUARDIAN_USER);
    const mine = inbox.filter((i) => i.wallet.id === w.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.deviceRequest.keyBase64).toBe(key2);
    expect(mine[0]?.wallet.stellarAddress).toBe(address);
  });

  testIt("progress public: có mirror → shape vô hại; ví lạ → null (route trả 'none')", async () => {
    const address = randomAddress();
    const [w] = await db
      .insert(wallets)
      .values({ userId: "it-pr-owner2", stellarAddress: address, threshold: 2 })
      .returning({ id: wallets.id });
    if (!w) throw new Error("wallet insert failed");
    cleanupWalletIds.push(w.id);
    const approver = `C${"A".repeat(55)}`;
    await db.insert(recoveryRequests).values({
      walletId: w.id,
      newOwner: "c".repeat(56),
      status: "pending",
      approvals: 1,
      threshold: 2,
      // R4-B3: signals.approvers do indexer ghi — rác lẫn vào phải bị lọc,
      // KHÔNG được rò ra cửa public.
      signals: {
        approvers: [
          { guardian: approver, txHash: "a".repeat(64) },
          { guardian: "not-an-address", txHash: "b".repeat(64) },
          { guardian: approver, txHash: "KHÔNG-PHẢI-HEX" },
        ],
        riskNote: "trường khác của risk engine — không thuộc cửa public",
      },
    });

    const progress = await publicProgressByAddress(address);
    expect(progress?.status).toBe("pending");
    expect(progress?.approvals).toBe(1);
    expect(progress?.threshold).toBe(2);
    // Địa chỉ NGƯỜI DUYỆT đủ 56 ký tự + tx hash; entry rác bị lọc, txHash sai
    // dạng hạ về null (link không dựng được thì thôi, không dựng link rác).
    expect(progress?.approvers).toEqual([
      { guardian: approver, txHash: "a".repeat(64) },
      { guardian: approver, txHash: null },
    ]);
    // Không id nội bộ, không userId — đúng các trường đã khai, không hơn.
    expect(Object.keys(progress ?? {}).sort()).toEqual([
      "approvals",
      "approvers",
      "startedAt",
      "status",
      "threshold",
      "vetoUntil",
    ]);

    expect(await publicProgressByAddress(randomAddress())).toBeNull();
  });
});
