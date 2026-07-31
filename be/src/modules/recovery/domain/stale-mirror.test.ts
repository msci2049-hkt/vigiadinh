// Lô R7 — cổng nghiệm thu của LUẬT dọn mirror. Thuần, không chain, không DB.
//
// Đây là chỗ đắt nhất của cả lô: đánh dấu nhầm `expired` = xoá một yêu cầu khôi
// phục THẬT khỏi hộp thư người bảo hộ, đúng lúc ai đó đang mất máy và cần họ bấm
// duyệt. Nên mọi nhánh của luật phải có ca riêng, và ca "không đọc được chain"
// phải được khoá chặt nhất.
import { describe, expect, it } from "bun:test";
import { chainSaysRequestIsDead, classifyReadFailure } from "./stale-mirror";

/** `SIMULATION_FAILED:` + mã contract — đúng dạng StellarServiceError sinh ra. */
const simError = (n: number) =>
  new Error(`SIMULATION_FAILED:HostError: Error(Contract, #${n}), Event log ...`);

describe("classifyReadFailure — tách 'chain nói không có' khỏi 'không đọc được'", () => {
  it("panic NoActiveRecovery (#8) = câu trả lời DỨT KHOÁT", () => {
    expect(classifyReadFailure(simError(8))).toBe("no-request");
  });

  it("🔴 lỗi mạng/timeout = KHÔNG BIẾT, không phải 'không có'", () => {
    expect(classifyReadFailure(new Error("fetch failed"))).toBe("unreadable");
    expect(classifyReadFailure(new Error("ETIMEDOUT"))).toBe("unreadable");
    expect(classifyReadFailure(new Error("503 Service Unavailable"))).toBe("unreadable");
  });

  it("🔴 mã contract KHÁC = KHÔNG BIẾT — mã lạ nghĩa là ta chưa hiểu chuyện gì", () => {
    // #7 RecoveryInProgress: có yêu cầu đang chạy hẳn hoi. Nhận nhầm thành
    // "không có" ở đây là xoá đúng cái yêu cầu đang sống.
    expect(classifyReadFailure(simError(7))).toBe("unreadable");
    expect(classifyReadFailure(simError(2))).toBe("unreadable");
    expect(classifyReadFailure(simError(18))).toBe("unreadable");
  });

  it("thứ ném ra không phải Error cũng là KHÔNG BIẾT", () => {
    expect(classifyReadFailure("boom")).toBe("unreadable");
    expect(classifyReadFailure(null)).toBe("unreadable");
    expect(classifyReadFailure(undefined)).toBe("unreadable");
  });
});

describe("chainSaysRequestIsDead — ba điều kiện (a)(b)(c), ngoài ra KHÔNG đụng", () => {
  const NOW = 1_800_000_000;

  it("(a) contract không có yêu cầu nào → dọn", () => {
    expect(chainSaysRequestIsDead({ kind: "no-request" }, NOW)).toBe(true);
  });

  it("(b) chain nói cancelled/finalized → dọn", () => {
    for (const status of ["cancelled", "finalized"]) {
      expect(
        chainSaysRequestIsDead({ kind: "request", request: { status, expiresAt: null } }, NOW),
      ).toBe(true);
    }
  });

  it("(c) pending/approved NHƯNG quá expires_at → dọn", () => {
    // Ca mà "chain không có yêu cầu" KHÔNG BAO GIỜ bắt được:
    // `get_recovery_status` trả `request()` (lib.rs:160-171) — không lọc hết hạn,
    // nên yêu cầu chết vẫn về đây dưới dạng Pending.
    for (const status of ["pending", "approved"]) {
      expect(
        chainSaysRequestIsDead({ kind: "request", request: { status, expiresAt: NOW - 1 } }, NOW),
      ).toBe(true);
    }
  });

  it("pending/approved còn hạn → KHÔNG đụng (yêu cầu đang sống)", () => {
    for (const status of ["pending", "approved"]) {
      expect(
        chainSaysRequestIsDead({ kind: "request", request: { status, expiresAt: NOW + 1 } }, NOW),
      ).toBe(false);
    }
  });

  it("đúng mốc expires_at (now == expiresAt) → CHƯA chết", () => {
    // Contract dùng `now > req.expires_at` để chối finalize (lib.rs:396) — bằng
    // nhau vẫn còn sống. Mirror phải theo đúng bất đẳng thức đó.
    expect(
      chainSaysRequestIsDead(
        { kind: "request", request: { status: "pending", expiresAt: NOW } },
        NOW,
      ),
    ).toBe(false);
  });

  it("🔴 NEGATIVE CONTROL — không đọc được chain thì KHÔNG BAO GIỜ dọn", () => {
    expect(chainSaysRequestIsDead({ kind: "unreadable" }, NOW)).toBe(false);
    // Kể cả rất lâu sau: mù là mù, thời gian trôi không biến nó thành kết luận.
    expect(chainSaysRequestIsDead({ kind: "unreadable" }, NOW + 10 * 365 * 86_400)).toBe(false);
  });

  it("🔴 expires_at không đọc được (null) + pending → KHÔNG BIẾT → không dọn", () => {
    expect(
      chainSaysRequestIsDead(
        { kind: "request", request: { status: "pending", expiresAt: null } },
        NOW,
      ),
    ).toBe(false);
  });
});
