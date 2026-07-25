// QA "logout xoá thật" (§2.1 fe-smooth): đăng xuất phải (1) kết thúc phiên app,
// (2) xoá phiên ví SEP-45 khỏi localStorage qua registry dọn dẹp, (3) xoá SẠCH
// query cache — kể cả khi BE không với tới (dọn local là chắc chắn).
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerSessionCleanup, resetSessionCleanupForTest } from "@/lib/session-cleanup";
import { performSignOut } from "./sign-out-cleanup";

vi.mock("@/lib/auth-client", () => ({
  signOut: vi.fn(),
}));

import { signOut } from "@/lib/auth-client";

describe("performSignOut — logout xoá thật", () => {
  beforeEach(() => {
    resetSessionCleanupForTest();
    localStorage.clear();
  });
  afterEach(() => {
    resetSessionCleanupForTest();
  });

  it("xoá phiên ví đã đăng ký + xoá sạch query cache", async () => {
    vi.mocked(signOut).mockResolvedValue(undefined as never);
    // Mô phỏng features/wallet đăng ký dọn JWT ví (như wallet-token.ts làm thật).
    localStorage.setItem("fw.wallet-jwt", "eyJ...");
    registerSessionCleanup(() => localStorage.removeItem("fw.wallet-jwt"));

    const queryClient = new QueryClient();
    queryClient.setQueryData(["family", "wallets"], [{ id: "w1" }]);

    await performSignOut(queryClient);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("fw.wallet-jwt")).toBeNull();
    expect(queryClient.getQueryData(["family", "wallets"])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("BE chết lúc signOut vẫn dọn local (finally)", async () => {
    vi.mocked(signOut).mockRejectedValue(new TypeError("Failed to fetch"));
    localStorage.setItem("fw.wallet-jwt", "eyJ...");
    registerSessionCleanup(() => localStorage.removeItem("fw.wallet-jwt"));

    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "session"], { user: { id: "u1" } });

    await expect(performSignOut(queryClient)).rejects.toThrow();
    expect(localStorage.getItem("fw.wallet-jwt")).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("một cleanup ném lỗi không chặn cleanup khác", async () => {
    vi.mocked(signOut).mockResolvedValue(undefined as never);
    registerSessionCleanup(() => {
      throw new Error("storage hỏng");
    });
    let ran = false;
    registerSessionCleanup(() => {
      ran = true;
    });

    await performSignOut(new QueryClient());
    expect(ran).toBe(true);
  });
});
