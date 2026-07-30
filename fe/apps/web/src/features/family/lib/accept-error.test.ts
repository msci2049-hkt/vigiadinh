// Trang nhận lời mời từng gộp MỌI thất bại vào "Chưa tải được mục này. Kéo để
// làm mới…" — câu đó đúng cho lỗi mạng, và sai cho cả bốn nguyên nhân thật.
import { ApiError } from "@repo/core";
import { describe, expect, it } from "vitest";
import { mapAcceptError } from "./accept-error";

const apiErr = (status: number, code: string) =>
  new ApiError(`Request failed (${status})`, status, { error: { code, message: code } });

describe("mapAcceptError", () => {
  it("401 → nói phiên hết hạn + nút đăng nhập lại", () => {
    const v = mapAcceptError(apiErr(401, "UNAUTHENTICATED"));
    expect(v.title).toBe("guardians.accept.errSignedOutTitle");
    expect(v.action).toBe("login");
  });

  it("401 mã lạ vẫn ra câu 'phiên hết hạn' (status là đủ để biết)", () => {
    expect(mapAcceptError(apiErr(401, "SOMETHING_ELSE")).action).toBe("login");
  });

  it("404 INVITE_NOT_USABLE → 'lời mời không còn dùng được' (xin link mới)", () => {
    expect(mapAcceptError(apiErr(404, "INVITE_NOT_USABLE")).title).toBe(
      "guardians.accept.errGoneTitle",
    );
  });

  it("409 INVITE_ALREADY_ACCEPTED → 'đã được dùng rồi', KHÁC câu hết hạn", () => {
    const taken = mapAcceptError(apiErr(409, "INVITE_ALREADY_ACCEPTED"));
    const gone = mapAcceptError(apiErr(404, "INVITE_NOT_USABLE"));
    expect(taken.title).toBe("guardians.accept.errTakenTitle");
    expect(taken.title).not.toBe(gone.title);
  });

  it("409 GUARDIAN_IS_OWNER → giữ nguyên câu tử tế đã có", () => {
    expect(mapAcceptError(apiErr(409, "GUARDIAN_IS_OWNER")).title).toBe(
      "guardians.accept.selfTitle",
    );
  });

  it("429 → 'thao tác hơi nhanh'", () => {
    expect(mapAcceptError(apiErr(429, "RATE_LIMITED")).title).toBe("guardians.accept.errBusyTitle");
  });

  it("lỗi KHÔNG phải HTTP (passkey bị huỷ trên máy) → câu về danh tính, không đổ cho mạng", () => {
    const v = mapAcceptError(new DOMException("The operation was aborted.", "AbortError"));
    expect(v.title).toBe("guardians.accept.errIdentityTitle");
    expect(v.code).toBeUndefined();
  });

  it("mã lạ → câu chung KÈM mã kỹ thuật", () => {
    const v = mapAcceptError(apiErr(409, "WHAT_IS_THIS"));
    expect(v.title).toBe("guardians.accept.errGenericTitle");
    expect(v.code).toBe("WHAT_IS_THIS");
  });

  it("409 GUARDIAN_ALREADY_GUARDIAN → 'bạn đã bảo hộ ví này', KHÔNG rơi vào câu chung", () => {
    const v = mapAcceptError(apiErr(409, "GUARDIAN_ALREADY_GUARDIAN"));
    expect(v.title).toBe("guardians.accept.errAlreadyGuardianTitle");
    expect(v.code).toBeUndefined();
  });
});
