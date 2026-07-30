// GÁC LÔ 5 (2026-07-30): 26 kind rơi vào câu chung "Hoạt động của ví", và dòng
// `recovery.onchain.submitted` của `register_wallet` hiện SAI hẳn nội dung.
import { describe, expect, it } from "vitest";
import { auditDetails, auditKindKey, shortHash } from "./audit-kind";

// Danh sách BẮT BUỘC phủ — đúng những kind BE thật sự ghi vào audit_log
// (be/src/modules/{intents,indexer,inheritance,presence,recovery}, jobs/policy-apply).
const MUST_MAP = [
  "intent.settled",
  "intent.awaiting_guardian",
  "intent.guardian_approved",
  "intent.guardian_rejected",
  "intent.cancelled",
  "intent.submit_failed",
  "intent.created",
  "intent.expired",
  "guardian.health_changed",
  "guardian.approved",
  "approval.requested",
  "care.revoked",
  "g_add",
  "g_remove",
  "heartbeat",
  "heartbeat.received",
  "heartbeat.escalated",
  "inheritance_opened",
  "inheritance_claimed",
  "will_hash_anchored",
  "policy.evaluated",
  "policy.change_applied",
  "policy.raise_requested",
  "policy.raise_cancelled",
  "recovery.vetoed",
  "signature.completed",
  "transaction.settled",
  "register",
  "initiate",
  "approve",
  "cancel",
  "finalize",
  "indexer.gap",
];

describe("auditKindKey — không kind nào của BE còn rơi vào câu chung", () => {
  it.each(MUST_MAP)("%s có câu riêng", (kind) => {
    expect(auditKindKey(kind, null)).not.toBe("history.kind.other");
  });

  it("kind thật sự lạ → câu chung, KHÔNG hiện mã thô", () => {
    expect(auditKindKey("chua_co_ai_biet", null)).toBe("history.kind.other");
    expect(auditKindKey("", null)).toBe("history.kind.other");
  });

  it("`unknown:<kind>` của indexer được bóc vỏ rồi tra lại", () => {
    // indexer.service.ts ghi kind chưa biết thành `unknown:<kind>`; nếu sau này
    // contract phát `heartbeat` trước khi event-router biết, câu vẫn phải đúng.
    expect(auditKindKey("unknown:heartbeat", null)).toBe("history.kind.checkinSent");
    expect(auditKindKey("unknown:hoan_toan_moi", null)).toBe("history.kind.other");
  });
});

describe("auditKindKey — recovery.onchain.submitted đọc payload.method", () => {
  it("register_wallet → 'đã bật bảo vệ', KHÔNG phải câu chung về mạng lưới", () => {
    // Đây là dòng 14:21 của ví thật: trước bản vá nó hiện "Một thao tác đã được
    // gửi lên mạng lưới" trong khi nó là lúc ví được bật bảo vệ gia đình.
    expect(
      auditKindKey("recovery.onchain.submitted", {
        method: "register_wallet",
        hash: "b".repeat(64),
        status: "SUCCESS",
      }),
    ).toBe("history.kind.walletRegistered");
  });

  it.each([
    ["initiate_recovery", "history.kind.recoveryStarted"],
    ["approve_recovery", "history.kind.recoveryApproved"],
    ["cancel_recovery", "history.kind.recoveryBlocked"],
    ["finalize_recovery", "history.kind.recoveryDone"],
    ["add_guardian", "history.kind.familyAdded"],
  ])("%s → %s", (method, key) => {
    expect(auditKindKey("recovery.onchain.submitted", { method })).toBe(key);
  });

  it("method lạ hoặc thiếu → câu chung về mạng lưới (đúng mức độ chắc chắn)", () => {
    expect(auditKindKey("recovery.onchain.submitted", { method: "phuong_thuc_moi" })).toBe(
      "history.kind.actionSubmitted",
    );
    expect(auditKindKey("recovery.onchain.submitted", {})).toBe("history.kind.actionSubmitted");
    expect(auditKindKey("recovery.onchain.submitted", null)).toBe("history.kind.actionSubmitted");
  });
});

describe("auditDetails — bóc chi tiết mà KHÔNG vỡ khi payload thiếu/rác", () => {
  it("payload lệnh gửi đã xong: hash + trạng thái", () => {
    const hash = "a".repeat(64);
    expect(auditDetails({ payload: { intentId: "01K", hash, status: "SUCCESS" } })).toEqual({
      txHash: hash,
      statusKey: "history.detail.statusDone",
      amount: null,
      recipient: null,
    });
  });

  it("payload event on-chain: hash nằm trong data.txHash", () => {
    const hash = "c".repeat(64);
    expect(
      auditDetails({
        payload: {
          eventId: "ev-1",
          ledger: 3875394,
          data: { topics: ["register"], value: [2, "86400"], txHash: hash },
        },
      }).txHash,
    ).toBe(hash);
  });

  it("payload rỗng / null / kiểu lạ → mọi trường null, không throw", () => {
    for (const payload of [null, undefined, {}, [], 42, "chuoi", { hash: null }]) {
      expect(auditDetails({ payload })).toEqual({
        txHash: null,
        statusKey: null,
        amount: null,
        recipient: null,
      });
    }
  });

  it("hash sai hình dạng KHÔNG dựng link explorer (thà không có còn hơn trỏ vào rác)", () => {
    expect(auditDetails({ payload: { hash: "khong-phai-hash" } }).txHash).toBe(null);
    expect(auditDetails({ payload: { hash: "a".repeat(63) } }).txHash).toBe(null);
    expect(auditDetails({ payload: { hash: `${"a".repeat(63)}z` } }).txHash).toBe(null);
  });

  it("trạng thái lạ → null, KHÔNG dội mã kỹ thuật vào mặt người dùng", () => {
    expect(auditDetails({ payload: { status: "FAILED" } }).statusKey).toBe(
      "history.detail.statusFailed",
    );
    expect(auditDetails({ payload: { status: "PENDING" } }).statusKey).toBe(
      "history.detail.statusPending",
    );
    expect(auditDetails({ payload: { status: "TRY_AGAIN_LATER" } }).statusKey).toBe(
      "history.detail.statusPending",
    );
    expect(auditDetails({ payload: { status: "MOT_MA_LA" } }).statusKey).toBe(null);
  });

  it("số tiền: chuỗi stroops giữ nguyên từng chữ số (kể cả > 2^53)", () => {
    expect(auditDetails({ payload: null, amount: "650000000" }).amount).toBe("650000000");
    expect(auditDetails({ payload: null, amount: "9007199254740993" }).amount).toBe(
      "9007199254740993",
    );
    expect(auditDetails({ payload: null, amount: "-5" }).amount).toBe(null);
    expect(auditDetails({ payload: null, amount: "1.5" }).amount).toBe(null);
  });

  // ── B3: số tiền + người nhận đến từ trường phẳng do BE join ──────────────────
  it("người nhận: địa chỉ 56 ký tự nhận, rác thì null (không render chỗ trống)", () => {
    const addr = "CBYKUIYA7LNNVQJCMKVG664R75V23YX5V4GHGIP5VTDVFDU6GW35SYDI";
    expect(auditDetails({ payload: null, recipient: addr }).recipient).toBe(addr);
    expect(auditDetails({ payload: null, recipient: "CBYKUI" }).recipient).toBe(null);
    expect(auditDetails({ payload: null, recipient: "" }).recipient).toBe(null);
    expect(auditDetails({ payload: null, recipient: null }).recipient).toBe(null);
    expect(auditDetails({ payload: null }).recipient).toBe(null);
  });

  it("dòng có đủ tiền + người nhận + hash: cả bốn trường ra cùng lúc", () => {
    const addr = "CBYKUIYA7LNNVQJCMKVG664R75V23YX5V4GHGIP5VTDVFDU6GW35SYDI";
    const hash = "d".repeat(64);
    expect(
      auditDetails({
        payload: { intentId: "01K", hash, status: "SUCCESS" },
        amount: "650000000",
        recipient: addr,
      }),
    ).toEqual({
      txHash: hash,
      statusKey: "history.detail.statusDone",
      amount: "650000000",
      recipient: addr,
    });
  });
});

describe("shortHash", () => {
  it("rút gọn đủ để đối chiếu, không tràn dòng", () => {
    expect(shortHash(`${"a".repeat(60)}bcde`)).toBe("aaaaaaaa…bcde");
  });
});
