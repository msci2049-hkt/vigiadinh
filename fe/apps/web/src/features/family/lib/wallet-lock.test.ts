// Khoá đường gửi — luật ở đây quyết định người dùng có bị chặn hay không, nên
// hai chiều đều phải đúng: chặn khi THẬT SỰ chưa mở đường, và KHÔNG chặn khi
// chỉ vì chưa biết (query đang chạy / chain 502). Chặn nhầm = giữ người dùng
// khỏi tiền của họ dựa trên phỏng đoán.
import { describe, expect, it } from "vitest";
import type { Recoverability } from "../api/invites";
import { walletSendLock } from "./wallet-lock";

const rec = (over: Partial<Recoverability>): Recoverability => ({
  available: 0,
  threshold: 2,
  required: 3,
  recoverable: false,
  missing: 3,
  ...over,
});

describe("walletSendLock", () => {
  it("ví 0 người bảo hộ → khoá, bước tiếp theo là MỜI, con số 0/3", () => {
    const lock = walletSendLock({ recoverability: rec({}) });
    expect(lock).toEqual({
      locked: true,
      step: "invite",
      available: 0,
      required: 3,
      missing: 3,
    });
  });

  it("mới 2/3 người nhận lời → vẫn khoá, vẫn là bước MỜI", () => {
    const lock = walletSendLock({
      recoverability: rec({ available: 2, missing: 1 }),
      registeredOnchain: false,
    });
    expect(lock).toMatchObject({ locked: true, step: "invite", available: 2, missing: 1 });
  });

  it("đủ 3 người nhưng CHAIN nói chưa đăng ký → khoá, bước tiếp theo là HOÀN TẤT", () => {
    const lock = walletSendLock({
      recoverability: rec({ available: 3, recoverable: true, missing: 0 }),
      registeredOnchain: false,
    });
    expect(lock).toMatchObject({ locked: true, step: "register", available: 3 });
  });

  it("đủ người + đã đăng ký → KHÔNG khoá (người dùng bình thường không bị làm phiền)", () => {
    const lock = walletSendLock({
      recoverability: rec({ available: 3, recoverable: true, missing: 0 }),
      registeredOnchain: true,
    });
    expect(lock).toEqual({ locked: false });
  });

  it("đủ người, chain KHÔNG đọc được (undefined) → KHÔNG khoá — không đoán mò", () => {
    const lock = walletSendLock({
      recoverability: rec({ available: 3, recoverable: true, missing: 0 }),
    });
    expect(lock).toEqual({ locked: false });
  });

  it("chưa có dữ liệu người bảo hộ → KHÔNG khoá, và không bịa ra con số nào", () => {
    expect(walletSendLock({})).toEqual({ locked: false });
    expect(walletSendLock({ registeredOnchain: false })).toEqual({ locked: false });
  });

  it("BE bản cũ không trả `required` → tự tính max(3, threshold), không ra undefined", () => {
    const legacy = { available: 0, threshold: 5, recoverable: false, missing: 0 } as Recoverability;
    const lock = walletSendLock({ recoverability: legacy });
    expect(lock).toMatchObject({ locked: true, required: 5, missing: 5 });
  });
});
