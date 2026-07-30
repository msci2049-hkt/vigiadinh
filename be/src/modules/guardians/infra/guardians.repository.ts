// WHY: Query scoped theo OWNER ngay từ khung — trạng thái guardian chỉ chủ ví
// thấy (luật security.md #Quyền). JOIN wallets để assert ownership trong 1 query.
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { wallets } from "../../wallets/infra/wallets.schema";
import { guardianInvites } from "./guardian-invites.schema";
import { type Guardian, guardians } from "./guardians.schema";

const LIST_LIMIT = 100;

/** `label` sống ở guardian_invites (nguồn duy nhất — không copy sang guardians
 * để khỏi có hai bản chép lệch nhau); join theo (wallet_id, guardian_address). */
export type GuardianWithLabel = Guardian & { label: string | null };

// Audit 2026-07-25 (§6.5): `status` lọc TRONG SQL. Lọc sau LIMIT ở handler làm
// `?status=active` trả rỗng khi 100 guardian mới nhất đều khác trạng thái đó —
// sai im lặng, không phải chậm.
export async function listByWalletForOwner(
  walletId: string,
  ownerUserId: string,
  status?: string,
  limit = LIST_LIMIT,
): Promise<GuardianWithLabel[]> {
  const scope = and(eq(guardians.walletId, walletId), eq(wallets.userId, ownerUserId));
  const rows = await db
    .select({ guardian: guardians, label: guardianInvites.label })
    .from(guardians)
    .innerJoin(wallets, eq(guardians.walletId, wallets.id))
    // Mời lại cùng địa chỉ tạo nhiều invite khớp — orderBy invite mới nhất
    // trước rồi giữ dòng ĐẦU mỗi guardian (Map giữ thứ tự chèn).
    .leftJoin(
      guardianInvites,
      and(
        eq(guardianInvites.walletId, guardians.walletId),
        eq(guardianInvites.guardianAddress, guardians.onchainKey),
      ),
    )
    .where(status ? and(scope, eq(guardians.status, status)) : scope)
    .orderBy(desc(guardians.createdAt), desc(guardianInvites.createdAt))
    .limit(limit);
  const byId = new Map<string, GuardianWithLabel>();
  for (const r of rows) {
    if (!byId.has(r.guardian.id)) byId.set(r.guardian.id, { ...r.guardian, label: r.label });
  }
  return [...byId.values()];
}

/** Chiều NGƯỢC — các ví user này đang gác (màn "Ví tôi đang gác", C7).
 * CHỈ select cột an toàn + user.name và user.email (lô 30/07 — email CHỈ để
 * protectingItemView CHE rồi mới rời BE, bản đầy đủ không bao giờ vào response).
 *
 * Lô R1: thêm `stellarAddress`. Lý do nghiệp vụ, không phải tiện tay: chủ ví mất
 * máy KHÔNG có cách nào tìm lại địa chỉ ví của mình, và đường thoát duy nhất là
 * gọi cho người thân đọc hộ — nên guardian phải ĐỌC ĐƯỢC nó. Địa chỉ ví vốn
 * public trên chain nên hiện ra không phá lời hứa ở /passkey; SỐ DƯ và LỊCH SỬ
 * thì vẫn không đi qua đường này (và test key-list chốt cứng điều đó). */
export async function listProtectingForUser(userId: string, limit = LIST_LIMIT) {
  return db
    .select({
      id: guardians.id,
      walletId: guardians.walletId,
      stellarAddress: wallets.stellarAddress,
      status: guardians.status,
      createdAt: guardians.createdAt,
      lastSeenAt: guardians.lastSeenAt,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(guardians)
    .innerJoin(wallets, eq(guardians.walletId, wallets.id))
    .innerJoin(user, eq(wallets.userId, user.id))
    .where(and(eq(guardians.userId, userId), ne(guardians.status, "removed")))
    .orderBy(desc(guardians.createdAt))
    .limit(limit);
}
