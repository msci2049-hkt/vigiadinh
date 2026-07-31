// Lô R5 §4 — xin lại phiên ví chạy ĐÚNG MỘT LẦN (đếm số lần gọi login), thử ký
// lại đúng MỘT lần, và huỷ hộp thoại thì im lặng rút lui — không vòng lặp nào.
import { describe, expect, it, vi } from "vitest";
import { runSessionReconfirm } from "./session-reconfirm";

describe("runSessionReconfirm", () => {
  it("login thành công → gọi login ĐÚNG 1 lần, retry ĐÚNG 1 lần", async () => {
    const login = vi.fn().mockResolvedValue({ contractId: "C1" });
    const retry = vi.fn();
    const outcome = await runSessionReconfirm({ login, retry });
    expect(outcome).toBe("retried");
    expect(login).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("login hỏng → KHÔNG retry, KHÔNG gọi lại login (không vòng lặp xin phiên)", async () => {
    const login = vi.fn().mockRejectedValue(new Error("SEP45_DOWN"));
    const retry = vi.fn();
    const outcome = await runSessionReconfirm({ login, retry });
    expect(outcome).toBe("failed");
    expect(login).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("người dùng huỷ hộp thoại passkey lúc login → cancelled, không retry", async () => {
    const cancel = new Error("user cancelled");
    cancel.name = "NotAllowedError";
    const login = vi.fn().mockRejectedValue(cancel);
    const retry = vi.fn();
    expect(await runSessionReconfirm({ login, retry })).toBe("cancelled");
    expect(retry).not.toHaveBeenCalled();

    const kitCancel = vi.fn().mockRejectedValue(new Error("WALLET_CONNECT_CANCELLED"));
    expect(await runSessionReconfirm({ login: kitCancel, retry })).toBe("cancelled");
    expect(retry).not.toHaveBeenCalled();
  });

  it("retry ném lỗi → KHÔNG login lại lần nữa (lỗi hiển thị qua mutation state)", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const retry = vi.fn(() => {
      throw new Error("sign failed again");
    });
    // retry là fire-and-forget (mutation.mutate không throw) — nhưng nếu có
    // throw đồng bộ thì cũng không được kéo theo một vòng login mới.
    await expect(runSessionReconfirm({ login, retry })).rejects.toThrow("sign failed again");
    expect(login).toHaveBeenCalledTimes(1);
  });
});
