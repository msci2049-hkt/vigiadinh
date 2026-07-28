// inviteAcceptUrl — link người dùng THẬT SỰ gửi cho người thân. Sai ở đây là
// bug im lặng: link cụt/thiếu domain chỉ lộ ra khi người thân bấm không mở
// được (họ thì không biết báo lỗi cho ai).
import { describe, expect, it } from "vitest";
import { inviteAcceptUrl } from "./invites";

describe("inviteAcceptUrl", () => {
  it("ghép link đầy đủ đúng domain production", () => {
    expect(inviteAcceptUrl("tok123", "https://familyhaven.mscilabs.com")).toBe(
      "https://familyhaven.mscilabs.com/guardian/accept?token=tok123",
    );
  });

  it("token có ký tự đặc biệt được encode — không vỡ query string", () => {
    expect(inviteAcceptUrl("a/b+c", "https://familyhaven.mscilabs.com")).toBe(
      "https://familyhaven.mscilabs.com/guardian/accept?token=a%2Fb%2Bc",
    );
  });

  it("token rỗng → throw, không trả link cụt", () => {
    expect(() => inviteAcceptUrl("", "https://familyhaven.mscilabs.com")).toThrow(
      "INVITE_TOKEN_EMPTY",
    );
  });

  it("origin rỗng / 'null' (iframe sandbox) → throw, không trả link thiếu domain", () => {
    expect(() => inviteAcceptUrl("tok123", "")).toThrow("INVITE_ORIGIN_EMPTY");
    expect(() => inviteAcceptUrl("tok123", "null")).toThrow("INVITE_ORIGIN_EMPTY");
  });

  it("không truyền origin → dùng origin đang chạy (jsdom localhost trong test)", () => {
    expect(inviteAcceptUrl("tok123")).toBe(
      `${window.location.origin}/guardian/accept?token=tok123`,
    );
  });
});
