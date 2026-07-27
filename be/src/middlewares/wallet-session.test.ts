// §1.2 (audit 2026-07-25) — thu hồi phiên ví phải SỐNG trên đường HTTP thật.
//
// Vì sao test này tồn tại dù `jwt.test.ts` đã phủ `verifyWalletJwtCurrent`: cửa
// verify đó xanh từ phiên trước, trong khi KHÔNG route nào gọi nó. Test đơn vị
// của một hàm chết vẫn xanh — đó chính là cách lỗ này sống sót hai phiên. Ở đây
// ta bắn request qua ĐÚNG app Hono (`app.request`), qua đúng chuỗi middleware,
// nên "có route dùng chưa" là điều kiện để test chạy được.
//
// Dòng đỏ trên bản cũ (bỏ `app.use("/api/*", walletSession)` khỏi app.ts):
//   (fail) JWT ví có ver CŨ → 401 WALLET_SESSION_REVOKED  [nhận 401 NO_WALLET_SESSION]
//   (fail) JWT ví có ver ĐÚNG → 200 và trả claims          [nhận 401 NO_WALLET_SESSION]
import { describe, expect, it } from "bun:test";
import { env } from "@/env";
import { signWalletJwt } from "@/modules/sep45/jwt";
import { bearerToken } from "./wallet-session";

// Top-level await: trả giá nạp module MỘT lần lúc load file (xem chú thích dưới).
const { app: appUnderTest } = await import("@/app");

const now = () => Math.floor(Date.now() / 1000);

/** Envelope lỗi chuẩn của app (middlewares/error.ts) — đọc `code` có kiểu. */
type ErrorEnvelope = { error: { code: string; message: string } };
const errorCode = async (res: Response): Promise<string> =>
  ((await res.json()) as ErrorEnvelope).error.code;

/** JWT ví hợp lệ về chữ ký + hạn; `ver` do ca test chọn. */
function walletJwt(account: string, ver: number | undefined): string {
  return signWalletJwt(env.BETTER_AUTH_SECRET, {
    iss: "test",
    sub: account,
    iat: now(),
    exp: now() + 3600,
    jti: crypto.randomUUID(),
    home_domain: "test.local",
    ...(ver === undefined ? {} : { ver }),
  });
}

describe("bearerToken — tách token khỏi header Authorization", () => {
  it("đọc được Bearer bất kể hoa thường (RFC 7235)", () => {
    expect(bearerToken("Bearer abc")).toBe("abc");
    expect(bearerToken("bearer abc")).toBe("abc");
    expect(bearerToken("BEARER  abc  ")).toBe("abc");
  });

  it("bỏ qua scheme khác và header rỗng", () => {
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer   ")).toBeNull();
  });
});

describe("§1.2 — JWT ví đã thu hồi bị chối trên đường HTTP thật", () => {
  // C-address HỢP LỆ thật (StrKey.encodeContract) — địa chỉ bịa làm /challenge
  // ném 500 ở tầng SDK, và khi đó ca "cửa login vẫn mở" xanh vì lý do sai.
  const account = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";
  // Nạp `app` ở TẦNG MODULE, không trong ca test: import này kéo theo auth +
  // redis + pool DB và trên WSL/mnt mất >5s, nhiều hơn timeout mặc định của
  // bun:test — ca chạy đầu tiên đỏ vì môi trường chậm chứ không vì bảo mật.
  const app = appUnderTest;

  it("KHÔNG có Bearer → /api/sep45/session trả 401 NO_WALLET_SESSION", async () => {
    const res = await app.request("/api/sep45/session");
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("NO_WALLET_SESSION");
  });

  it("Bearer KHÔNG phải JWT ví → đi lọt (Better Auth sở hữu token đó)", async () => {
    // Session token Better Auth không phải JWT 3 phần → state `none`. Không được
    // 401 WALLET_SESSION_REVOKED, nếu không mọi client dùng Bearer của Better Auth
    // bị khoá ngoài toàn bộ API.
    const res = await app.request("/api/sep45/session", {
      headers: { authorization: "Bearer nOtAjWtAtAlL.justAsessionToken" },
    });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("NO_WALLET_SESSION");
  });

  it("JWT ví của ví KHÔNG có trong DB → 401 WALLET_SESSION_REVOKED", async () => {
    // Ví không tra được → lookup trả null → fail-closed. Đây cũng là ca "token
    // phát trước khi có cột jwt_version" (thiếu `ver`).
    const res = await app.request("/api/sep45/session", {
      headers: { authorization: `Bearer ${walletJwt(account, 0)}` },
    });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("WALLET_SESSION_REVOKED");
  });

  it("JWT ví thiếu `ver` → 401 WALLET_SESSION_REVOKED (không im lặng bỏ qua)", async () => {
    const res = await app.request("/api/sep45/session", {
      headers: { authorization: `Bearer ${walletJwt(account, undefined)}` },
    });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("WALLET_SESSION_REVOKED");
  });

  it("cửa đăng nhập ví VẪN mở khi cầm token đã thu hồi (chống khoá ngoài)", async () => {
    // Người vừa mất thiết bị chính là người cầm token chết. Nếu /challenge cũng
    // 401 thì họ không bao giờ đăng nhập lại được — bẫy khoá cứng.
    const res = await app.request(`/api/sep45/challenge?account=${account}`, {
      headers: { authorization: `Bearer ${walletJwt(account, 0)}` },
    });
    expect(res.status).not.toBe(401);
  });

  it("/health KHÔNG bị token ví chết làm hỏng", async () => {
    const res = await app.request("/health", {
      headers: { authorization: `Bearer ${walletJwt(account, 0)}` },
    });
    expect(res.status).toBe(200);
  });
});
