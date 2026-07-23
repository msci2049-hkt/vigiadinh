// WHY: Bootstrap admin ĐẦU TIÊN cho Better Auth admin plugin — giải
// chicken-and-egg (mọi thao tác admin API đòi 1 admin đăng nhập sẵn).
// Idempotent theo email: user đã tồn tại → chỉ đảm bảo role=admin (KHÔNG đổi
// mật khẩu); chưa có → tạo user + credential account với scrypt pinned
// (lib/password-hash — cùng format Better Auth verify).
//
// Chạy:  SEED_ADMIN_EMAIL=boss@x.com SEED_ADMIN_PASSWORD='<đủ ≥12 ký tự>' bun run seed:admin
// Dev không set env → dùng default admin@example.com / admin123456789 (CHỈ dev).
// SEED_ADMIN_* KHÔNG nằm trong env.schema (script-only) — không ảnh hưởng env-parity.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { account, user } from "@/db/schema/auth";
import { hashPassword } from "@/lib/password-hash";

const DEV_EMAIL = "admin@example.com";
const DEV_PASSWORD = "admin123456789"; // 14 ký tự — chỉ dùng khi NODE_ENV≠production

async function main(): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase() || DEV_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEV_PASSWORD;

  // Prod BẮT BUỘC set tường minh — cấm default lọt lên môi trường thật.
  if (isProd && (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD)) {
    console.error("[seed-admin] Production PHẢI set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("[seed-admin] Mật khẩu phải ≥ 12 ký tự (khớp minPasswordLength của BE).");
    process.exit(1);
  }

  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });

  if (existing) {
    if (existing.role === "admin") {
      console.log(`[seed-admin] ${email} đã là admin — không đổi gì.`);
      return;
    }
    await db.update(user).set({ role: "admin" }).where(eq(user.id, existing.id));
    console.log(`[seed-admin] Nâng ${email} → role=admin (mật khẩu giữ nguyên).`);
    return;
  }

  const userId = randomUUID();
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Admin",
    email,
    emailVerified: true, // admin bootstrap — không đi luồng verify email
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(account).values({
    id: randomUUID(),
    // BA convention cho credential provider: accountId = userId.
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[seed-admin] Đã tạo admin ${email} (đăng nhập /login của FE, vào /admin).`);
}

main()
  .catch((err) => {
    console.error("[seed-admin] FAILED:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
