// Test JWT ví — sign/verify roundtrip + tamper + hết hạn. Secret random mỗi lần chạy.
import { describe, expect, it } from "bun:test";
import { signWalletJwt, verifyWalletJwtCurrent, verifyWalletJwtSignatureOnly } from "./jwt";
import type { WalletJwtClaims } from "./types";

const secret = crypto.randomUUID() + crypto.randomUUID();
const now = Math.floor(Date.now() / 1000);

const claims: WalletJwtClaims = {
  iss: "localhost:3000",
  sub: "C".padEnd(56, "A"),
  iat: now,
  exp: now + 3600,
  jti: "x".repeat(64),
  home_domain: "localhost:5173",
  device: "device-1234",
};

describe("sep45 jwt", () => {
  it("sign → verify roundtrip giữ đủ claims (sub = địa chỉ ví, device bind)", () => {
    const token = signWalletJwt(secret, claims);
    expect(verifyWalletJwtSignatureOnly(secret, token)).toEqual(claims);
  });

  it("đổi 1 ký tự payload → null", () => {
    const token = signWalletJwt(secret, claims);
    const [h, p, s] = token.split(".") as [string, string, string];
    const tampered = `${h}.${p.slice(0, -2)}AA.${s}`;
    expect(verifyWalletJwtSignatureOnly(secret, tampered)).toBeNull();
  });

  it("sai secret → null", () => {
    const token = signWalletJwt(secret, claims);
    expect(verifyWalletJwtSignatureOnly("khac-secret-hoan-toan-1234567890", token)).toBeNull();
  });

  it("token hết hạn → null", () => {
    const token = signWalletJwt(secret, { ...claims, exp: now - 1 });
    expect(verifyWalletJwtSignatureOnly(secret, token)).toBeNull();
  });

  it("chuỗi rác → null, không throw", () => {
    expect(verifyWalletJwtSignatureOnly(secret, "abc")).toBeNull();
    expect(verifyWalletJwtSignatureOnly(secret, "a.b.c")).toBeNull();
  });
});

// Closeout §4 — THU HỒI. Trước bản này `verifyWalletJwt` chỉ kiểm chữ ký + `exp`,
// nên sau khi recovery xoay khoá, thiết bị cũ hết KÝ được (on-chain cưỡng chế) mà
// vẫn ĐỌC được bằng JWT cũ tới hết TTL. Custody chặn mất tiền; nó không chặn đọc
// dữ liệu phiên của gia đình — và người vừa bị chiếm thiết bị là người ít muốn kẻ
// kia còn đọc được nhất.
describe("sep45 jwt — thu hồi theo số hiệu phiên (jwt_version)", () => {
  const v0 = { ...claims, ver: 0 };

  it("ver khớp DB → nhận", async () => {
    const token = signWalletJwt(secret, v0);
    const got = await verifyWalletJwtCurrent(secret, token, async () => 0);
    expect(got?.sub).toBe(v0.sub);
  });

  it("recovery đã tăng bậc (DB=1, token ver=0) → 401/null NGAY, không đợi exp", async () => {
    // Token còn hạn một tiếng, chữ ký hợp lệ hoàn toàn — chỉ số hiệu là cũ.
    const token = signWalletJwt(secret, v0);
    expect(verifyWalletJwtSignatureOnly(secret, token)).not.toBeNull();
    expect(await verifyWalletJwtCurrent(secret, token, async () => 1)).toBeNull();
  });

  it("token KHÔNG có ver (phát trước bản này) → chối", async () => {
    // Fail-closed: token thời kỳ không-thu-hồi-được không được tiếp tục sống.
    const token = signWalletJwt(secret, claims);
    expect(await verifyWalletJwtCurrent(secret, token, async () => 0)).toBeNull();
  });

  it("ví không tra được trong DB → chối (không fail-open)", async () => {
    const token = signWalletJwt(secret, v0);
    expect(await verifyWalletJwtCurrent(secret, token, async () => null)).toBeNull();
  });

  it("chữ ký sai vẫn chối kể cả khi ver khớp", async () => {
    const token = signWalletJwt("secret-khac-hoan-toan-0987654321", v0);
    expect(await verifyWalletJwtCurrent(secret, token, async () => 0)).toBeNull();
  });
});
