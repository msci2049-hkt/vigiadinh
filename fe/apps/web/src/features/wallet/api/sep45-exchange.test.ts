// Cửa đổi JWT ví → session app, phía FE: body lỗi của Better Auth là `{message}`
// (KHÔNG phải envelope `{error:{code}}` của app) — test khoá việc đọc đúng shape
// đó, kèm email che đi nguyên vẹn tới UI. Sai shape là mọi lỗi rơi về "generic"
// và người dùng lại nhận câu chung — đúng bệnh lô 29/07 sáng.
import { ApiError } from "@repo/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeForAppSession, SessionExchangeError } from "./sep45-exchange";

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function errFrom(status: number, body: unknown): Promise<SessionExchangeError> {
  mockFetchOnce(status, body);
  try {
    await exchangeForAppSession("token");
    throw new Error("phải ném");
  } catch (err) {
    expect(err).toBeInstanceOf(SessionExchangeError);
    return err as SessionExchangeError;
  }
}

describe("exchangeForAppSession — dịch lỗi cửa đổi", () => {
  it("409 WALLET_BELONGS_TO_OTHER_ACCOUNT:mask → code + email che", async () => {
    const err = await errFrom(409, { message: "WALLET_BELONGS_TO_OTHER_ACCOUNT:bad***@gmail.com" });
    expect(err.code).toBe("belongsToOther");
    expect(err.maskedEmail).toBe("bad***@gmail.com");
  });

  it("403 WALLET_UNKNOWN → walletUnknown", async () => {
    expect((await errFrom(403, { message: "WALLET_UNKNOWN" })).code).toBe("walletUnknown");
  });

  it("403 WALLET_SESSION_REVOKED → revoked (khoá cũ sau khôi phục)", async () => {
    expect((await errFrom(403, { message: "WALLET_SESSION_REVOKED" })).code).toBe("revoked");
  });

  it("mã lạ / body lạ → generic, không văng", async () => {
    expect((await errFrom(403, { message: "WALLET_TOKEN_STALE" })).code).toBe("generic");
    expect((await errFrom(500, "not-json-shape")).code).toBe("generic");
  });

  it("thành công (200) → không ném", async () => {
    mockFetchOnce(200, { user: { id: "u1" }, wallet_id: "w1" });
    await expect(exchangeForAppSession("token")).resolves.toBeUndefined();
  });

  it("lỗi không phải HTTP (mạng đứt) → generic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    try {
      await exchangeForAppSession("token");
      throw new Error("phải ném");
    } catch (err) {
      // TypeError của fetch không phải ApiError → bọc thành generic.
      expect(err).toBeInstanceOf(SessionExchangeError);
      expect((err as SessionExchangeError).code).toBe("generic");
    }
  });

  it("ApiError vẫn là ApiError ở tầng dưới (sanity — không nuốt nhầm class)", () => {
    expect(new ApiError("x", 403, { message: "y" })).toBeInstanceOf(ApiError);
  });
});
