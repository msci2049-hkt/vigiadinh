import { describe, expect, it } from "bun:test";
import {
  type InviteStatus,
  isUsable,
  publicInviteView,
  recoverability,
  registeredCount,
} from "./domain";

describe("guardian invites — khả năng khôi phục", () => {
  it("CHỈ đếm người đã lên chain, không đếm lời mời đã gửi", () => {
    const statuses: InviteStatus[] = ["sent", "accepted", "deployed", "registered"];
    expect(registeredCount(statuses)).toBe(1);
  });

  it("mời 3 người nhưng chưa ai nhận lời → ví CHƯA khôi phục được", () => {
    const view = recoverability({ statuses: ["sent", "sent", "sent"], threshold: 2 });
    expect(view.recoverable).toBe(false);
    expect(view.available).toBe(0);
    // required = max(MIN_GUARDIANS=3, threshold=2) — registry đòi 3 người,
    // không phải 2 (bug "0 trên 2" cũ so với threshold).
    expect(view.required).toBe(3);
    expect(view.missing).toBe(3);
  });

  it("deployed vẫn CHƯA tính — khoá chưa lên chain thì chưa cứu được ai", () => {
    const view = recoverability({ statuses: ["registered", "deployed"], threshold: 2 });
    expect(view.recoverable).toBe(false);
    expect(view.missing).toBe(2);
  });

  it("CA HỒI QUY bug '0 trên 2': đủ threshold=2 nhưng DƯỚI MIN_GUARDIANS=3 → vẫn CHƯA register được", () => {
    // Trước bản vá: available=2 ≥ threshold=2 → recoverable=true → banner xanh
    // "đã an toàn" → nút Đăng ký mở → contract panic #4 TooFewGuardians.
    const view = recoverability({
      statuses: ["registered", "registered"],
      threshold: 2,
    });
    expect(view.recoverable).toBe(false);
    expect(view.missing).toBe(1);
  });

  it("đủ max(MIN_GUARDIANS, threshold) → khôi phục được", () => {
    const view = recoverability({
      statuses: ["registered", "registered", "registered", "sent"],
      threshold: 2,
    });
    expect(view.recoverable).toBe(true);
    expect(view.missing).toBe(0);
  });

  it("threshold cao hơn MIN_GUARDIANS → required theo threshold", () => {
    const view = recoverability({
      statuses: ["registered", "registered", "registered"],
      threshold: 4,
    });
    expect(view.required).toBe(4);
    expect(view.recoverable).toBe(false);
    expect(view.missing).toBe(1);
  });

  it("thừa người bảo hộ không làm missing âm", () => {
    const view = recoverability({
      statuses: ["registered", "registered", "registered", "registered"],
      threshold: 2,
    });
    expect(view.missing).toBe(0);
  });
});

describe("guardian invites — lời mời còn dùng được", () => {
  const now = new Date("2026-07-24T00:00:00Z");

  it("hết hạn → không dùng được", () => {
    expect(isUsable({ status: "sent", expiresAt: new Date("2026-07-23T00:00:00Z") }, now)).toBe(
      false,
    );
  });

  it("đã đăng ký xong → không dùng lại (chống tái sử dụng link)", () => {
    expect(
      isUsable({ status: "registered", expiresAt: new Date("2026-08-01T00:00:00Z") }, now),
    ).toBe(false);
  });

  it("còn hạn + chưa ai nhận → dùng được", () => {
    expect(isUsable({ status: "sent", expiresAt: new Date("2026-08-01T00:00:00Z") }, now)).toBe(
      true,
    );
  });

  // Hồi quy audit 2026-07-25 (P0-5). Bản cũ chỉ loại `expired` + `registered`,
  // nên link VẪN SỐNG sau khi người thân đã nhận lời. Ai có link — chuyển tiếp
  // trong nhóm chat, xem lỏm màn hình — chỉ cần gọi lại `accept` với địa chỉ
  // của mình là ghi đè `guardian_address`, rồi chủ ví tự tay ký cho kẻ lạ vào
  // làm người bảo hộ trên một dòng vẫn mang tên "Mẹ".
  it("ĐÃ có người nhận (deployed) → link CHẾT, không nhận lại được", () => {
    expect(isUsable({ status: "deployed", expiresAt: new Date("2026-08-01T00:00:00Z") }, now)).toBe(
      false,
    );
  });

  it("đã mở link (accepted) → cũng không nhận lại được", () => {
    expect(isUsable({ status: "accepted", expiresAt: new Date("2026-08-01T00:00:00Z") }, now)).toBe(
      false,
    );
  });
});

describe("publicInviteView — trang nhận lời mời công khai KHÔNG rò dữ liệu (A-Q3)", () => {
  const now = new Date("2026-07-28T00:00:00Z");
  const future = new Date("2026-08-01T00:00:00Z");
  const past = new Date("2026-07-01T00:00:00Z");

  it("còn sống → usable + owner_name; KHÔNG có email/địa chỉ ví/số dư trong shape", () => {
    const view = publicInviteView(
      { label: "Mẹ", status: "sent", expiresAt: future },
      "Chủ Ví",
      now,
    );
    expect(view.usable).toBe(true);
    expect(view.owner_name).toBe("Chủ Ví");
    // Chốt danh sách key — thêm trường mới vào đường public là test này ĐỎ,
    // buộc người sửa tự trả lời "trường này có an toàn không".
    expect(Object.keys(view).sort()).toEqual([
      "expires_at",
      "label",
      "owner_name",
      "status",
      "usable",
    ]);
  });

  it("sent nhưng quá hạn → reason=expired, KHÔNG kèm owner_name", () => {
    const view = publicInviteView({ label: "Mẹ", status: "sent", expiresAt: past }, "Chủ Ví", now);
    expect(view.usable).toBe(false);
    expect(view.reason).toBe("expired");
    expect("owner_name" in view).toBe(false);
  });

  it("đã nhận lời (accepted/deployed/registered) → reason=used, hai câu khác nhau trên màn", () => {
    for (const status of ["accepted", "deployed", "registered"] as const) {
      const view = publicInviteView({ label: "Mẹ", status, expiresAt: future }, "Chủ Ví", now);
      expect(view.usable).toBe(false);
      expect(view.reason).toBe("used");
    }
  });

  it("status=expired → reason=expired", () => {
    const view = publicInviteView({ label: "Mẹ", status: "expired", expiresAt: future }, null, now);
    expect(view.reason).toBe("expired");
  });
});
