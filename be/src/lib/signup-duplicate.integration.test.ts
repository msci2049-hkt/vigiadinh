// L1 30/07: đăng ký bằng email ĐÃ TỒN TẠI phải bị chối THẲNG (422
// USER_ALREADY_EXISTS) tại hooks.before (lib/auth.ts) — không rơi vào nhánh
// success GIẢ của BA (anti-enumeration mặc định khi requireEmailVerification
// hoặc autoSignIn:false). Nhánh giả là nguồn sự cố: FE tưởng thành công, dẫn
// người dùng sang màn OTP chờ mã không bao giờ đến, bấm "Gửi lại" là gửi email
// xác minh cho tài khoản đã có. Hook ném TRƯỚC mọi thứ → không email nào đi.
//
// Chạy qua handler Better Auth thật + Postgres thật (khuôn sep45-exchange).
import { afterAll, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "@/app";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { pgReachable, SKIP_REASON } from "@/test-support/pg";

const dbUp = await pgReachable();
if (!dbUp) console.warn(SKIP_REASON);
const testIt = dbUp ? it : it.skip;

const ORIGIN = "http://localhost:5173";
const PASSWORD = "Str0ngPassw0rd!23";

// Rate-limit key theo IP (x-forwarded-for) — sign-up trần 3/60s. IP giả riêng
// từng request để không tự giẫm nhau (cùng lý do với sep45-exchange test).
let ipCounter = 0;
function fakeIp(): string {
  ipCounter += 1;
  return `10.98.0.${ipCounter}`;
}

const suffix = crypto.randomUUID().slice(0, 8);
const EMAIL = `dup-guard-${suffix}@example.com`;

async function signUp(email: string): Promise<Response> {
  return app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-forwarded-for": fakeIp(),
    },
    body: JSON.stringify({ name: "Dup Guard", email, password: PASSWORD }),
  });
}

afterAll(async () => {
  if (!dbUp) return;
  await db.delete(user).where(eq(user.email, EMAIL));
});

describe("sign-up email trùng (hooks.before, lib/auth.ts)", () => {
  testIt("email MỚI vẫn đăng ký được như cũ (không hồi quy)", async () => {
    const res = await signUp(EMAIL);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string } };
    expect(body.user.email).toBe(EMAIL);
  });

  testIt("email ĐÃ TỒN TẠI → 422 USER_ALREADY_EXISTS, không success giả", async () => {
    const res = await signUp(EMAIL);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code?: string; message?: string };
    expect(body.code).toBe("USER_ALREADY_EXISTS");
  });

  testIt("so email không phân biệt hoa thường (BA normalize lowercase)", async () => {
    const res = await signUp(EMAIL.toUpperCase());
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("USER_ALREADY_EXISTS");
  });
});
