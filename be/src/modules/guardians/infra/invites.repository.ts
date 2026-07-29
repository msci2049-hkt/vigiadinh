// Import schema xuyên module bằng đường dẫn TƯƠNG ĐỐI: ngoại lệ có chủ đích cho
// TẦNG SCHEMA (cùng khuôn recovery.repository) — FK/JOIN cần chính table object.
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { type GuardianInvite, guardianInvites } from "./guardian-invites.schema";
import { guardians } from "./guardians.schema";

/** Ví của CHÍNH user (chống chủ ví A mời hộ ví của B). */
export async function walletOwnedBy(walletId: string, userId: string) {
  const [row] = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.id, walletId), eq(wallets.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function insertInvite(data: {
  walletId: string;
  token: string;
  label: string;
  expiresAt: Date;
}): Promise<GuardianInvite> {
  const [row] = await db.insert(guardianInvites).values(data).returning();
  // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING luôn trả 1 dòng.
  return row!;
}

export async function listByWallet(walletId: string): Promise<GuardianInvite[]> {
  return db.select().from(guardianInvites).where(eq(guardianInvites.walletId, walletId));
}

/**
 * Tên HIỂN THỊ của chủ ví — cho trang nhận lời mời CÔNG KHAI ("<Tên> mời bạn
 * làm người bảo hộ"). CHỈ select cột name: email/địa chỉ ví/số dư không bao
 * giờ được đi qua đường public này (A-Q3).
 */
export async function findOwnerName(walletId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: user.name })
    .from(wallets)
    .innerJoin(user, eq(wallets.userId, user.id))
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row?.name ?? null;
}

/** userId chủ ví — đích của sự kiện realtime "guardian vừa nhận lời/vào ví". */
export async function findOwnerUserId(walletId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: wallets.userId })
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row?.userId ?? null;
}

export async function findByToken(token: string): Promise<GuardianInvite | null> {
  const [row] = await db
    .select()
    .from(guardianInvites)
    .where(eq(guardianInvites.token, token))
    .limit(1);
  return row ?? null;
}

export async function findById(id: string): Promise<GuardianInvite | null> {
  const [row] = await db.select().from(guardianInvites).where(eq(guardianInvites.id, id)).limit(1);
  return row ?? null;
}

/**
 * Người được mời nộp ĐỊA CHỈ ví hợp đồng của họ (chỉ public key material).
 *
 * So-và-đặt NGUYÊN TỬ: chỉ ăn khi dòng vẫn còn ở `sent`. Kiểm ở tầng handler là
 * chưa đủ — hai request gửi cùng lúc thì cả hai cùng thấy `sent` rồi cùng ghi,
 * và người ghi SAU thắng. Điều kiện phải nằm trong chính câu UPDATE.
 * Trả về false = lời mời đã có người nhận (handler map 409).
 */
export async function markDeployed(input: {
  id: string;
  userId: string;
  guardianAddress: string;
  now: Date;
}): Promise<boolean> {
  const rows = await db
    .update(guardianInvites)
    .set({
      status: "deployed",
      acceptedByUserId: input.userId,
      guardianAddress: input.guardianAddress,
      acceptedAt: input.now,
    })
    .where(and(eq(guardianInvites.id, input.id), eq(guardianInvites.status, "sent")))
    .returning({ id: guardianInvites.id });
  return rows.length > 0;
}

/** Ví đã có người bảo hộ mang đúng địa chỉ này chưa (loại `removed`). */
export async function guardianByKey(walletId: string, onchainKey: string) {
  const [row] = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(
      and(
        eq(guardians.walletId, walletId),
        eq(guardians.onchainKey, onchainKey),
        ne(guardians.status, "removed"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Chủ ví "Thêm vào ví" — chốt invite `registered` VÀ ghi dòng `guardians` trong
 * MỘT transaction. Trước bản này KHÔNG AI ghi bảng `guardians` cả: bước
 * `register` (đọc `activeGuardianKeys`) vì thế không bao giờ đủ khoá — bug
 * 28/07. So-và-đặt trên status `deployed` để hai request đua nhau chỉ một
 * người ghi; người thua nhận `"already"` (idempotent, không phải lỗi).
 */
export async function registerInviteAsGuardian(input: {
  invite: GuardianInvite;
  now: Date;
}): Promise<"ok" | "already"> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(guardianInvites)
      .set({ status: "registered", registeredAt: input.now })
      .where(and(eq(guardianInvites.id, input.invite.id), eq(guardianInvites.status, "deployed")))
      .returning({ id: guardianInvites.id });
    if (rows.length === 0) return "already";
    await tx.insert(guardians).values({
      walletId: input.invite.walletId,
      userId: input.invite.acceptedByUserId,
      onchainKey: input.invite.guardianAddress,
      status: "active",
    });
    return "ok";
  });
}
