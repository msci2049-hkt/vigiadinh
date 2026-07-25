import { describe, expect, it } from "bun:test";
import { type InviteStatus, isUsable, recoverability, registeredCount } from "./domain";

describe("guardian invites — khả năng khôi phục", () => {
  it("CHỈ đếm người đã lên chain, không đếm lời mời đã gửi", () => {
    const statuses: InviteStatus[] = ["sent", "accepted", "deployed", "registered"];
    expect(registeredCount(statuses)).toBe(1);
  });

  it("mời 3 người nhưng chưa ai nhận lời → ví CHƯA khôi phục được", () => {
    const view = recoverability({ statuses: ["sent", "sent", "sent"], threshold: 2 });
    expect(view.recoverable).toBe(false);
    expect(view.available).toBe(0);
    expect(view.missing).toBe(2);
  });

  it("deployed vẫn CHƯA tính — khoá chưa lên chain thì chưa cứu được ai", () => {
    const view = recoverability({ statuses: ["registered", "deployed"], threshold: 2 });
    expect(view.recoverable).toBe(false);
    expect(view.missing).toBe(1);
  });

  it("đủ ngưỡng → khôi phục được", () => {
    const view = recoverability({
      statuses: ["registered", "registered", "sent"],
      threshold: 2,
    });
    expect(view.recoverable).toBe(true);
    expect(view.missing).toBe(0);
  });

  it("thừa người bảo hộ không làm missing âm", () => {
    const view = recoverability({
      statuses: ["registered", "registered", "registered"],
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
