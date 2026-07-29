// Luồng MỜI người bảo hộ (wizard mức B — luồng tăng dần).
//
// Kiến trúc: chủ ví đã có ví CHẠY ĐƯỢC từ bước 1-2. Mời là chuỗi thao tác MỘT
// BÊN nối tiếp, không phải một giao dịch đa bên:
//   1. chủ ví tạo lời mời          → POST /invites          (tx: không)
//   2. người được mời mở link      → GET  /invites/:token   (public, chỉ đọc nhãn)
//   3. họ tạo passkey + deploy ví CỦA HỌ trên máy HỌ, nộp ĐỊA CHỈ
//                                   → POST /invites/:token/accept
//   4. chủ ví "Thêm vào ví":
//      · ví CHƯA đăng ký registry → chỉ bước 5 (chốt DB); `register_wallet`
//        (màn Xác nhận) gom cả danh sách lên chain MỘT lượt — gọi
//        `add_guardian` lúc này là contract chối `#2 NotRegistered` (bug 28/07)
//      · ví ĐÃ đăng ký            → recovery /addGuardian + /submit (tx riêng)
//   5. chốt trạng thái + ghi dòng `guardians` → POST /invites/registered
//
// BẤT BIẾN (cưỡng chế ở đây, ghi trong THREAT-MODEL):
//   · Backend KHÔNG BAO GIỜ sinh khoá hộ người bảo hộ.
//   · Người bảo hộ KHÔNG BAO GIỜ gửi private key lên server — cột duy nhất
//     nhận được là `guardian_address` (C…, công khai trên chain).
import { zValidator as zv } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { publishDomainEvent } from "@/lib/domain-events";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import * as repo from "../../infra/invites.repository";
import {
  INVITE_TTL_MS,
  type InviteStatus,
  isUsable,
  publicInviteView,
  recoverability,
} from "./domain";

const createBody = z.object({
  wallet_id: z.string().length(26),
  label: z.string().min(1).max(64),
});

const acceptBody = z.object({
  /** ĐỊA CHỈ ví hợp đồng của người bảo hộ — public, đọc được trên chain. */
  guardian_address: z.string().regex(/^C[A-Z2-7]{55}$/, "phải là contract ID (C...)"),
});

const registeredBody = z.object({ invite_id: z.string().length(26) });

/** Token mời: 32 byte ngẫu nhiên → 64 hex. Không đoán được, không suy ra từ id. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function requireUser(c: { get(key: "user"): { id: string } | null }): { id: string } {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  return user;
}

async function ownedWallet(walletId: string, userId: string) {
  const wallet = await repo.walletOwnedBy(walletId, userId);
  if (!wallet) throw new HTTPException(404, { message: "WALLET_NOT_FOUND" });
  return wallet;
}

// Đọc bằng token là cửa PUBLIC (người mất máy/chưa có tài khoản mở link) →
// limit để không thành cửa dò token.
const publicLimit = rateLimit({
  points: 30,
  duration: 60,
  keyPrefix: "guardian-invite-public",
  failOpen: false,
});

export const guardianInvitesRoute = new Hono()
  .post("/invites", requireAuth, zv("json", createBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    await ownedWallet(body.wallet_id, user.id);
    const invite = await repo.insertInvite({
      walletId: body.wallet_id,
      token: newToken(),
      label: body.label,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    return c.json({
      data: { id: invite.id, token: invite.token, label: invite.label, status: invite.status },
    });
  })

  /** Danh sách lời mời + câu trả lời "ví khôi phục được chưa". */
  .get("/invites/wallet/:walletId", requireAuth, async (c) => {
    const user = requireUser(c);
    const wallet = await ownedWallet(c.req.param("walletId"), user.id);
    const invites = await repo.listByWallet(wallet.id);
    return c.json({
      data: {
        invites: invites.map((i) => ({
          id: i.id,
          label: i.label,
          status: i.status,
          guardian_address: i.guardianAddress,
          expires_at: i.expiresAt,
        })),
        recoverability: recoverability({
          statuses: invites.map((i) => i.status as InviteStatus),
          threshold: wallet.threshold,
        }),
      },
    });
  })

  /**
   * PUBLIC — trang nhận lời mời đọc TRƯỚC khi đăng nhập (nguyên tắc: giải
   * thích trước, mật khẩu sau — link lạ đòi mật khẩu ngay là hình dạng của
   * trang lừa đảo). Trả CHỈ trường an toàn: nhãn gợi nhớ, tên hiển thị chủ
   * ví, hạn dùng, trạng thái. CẤM email / địa chỉ ví / số dư đi qua đây.
   *
   * 404 = token không tồn tại. Hết hạn / đã dùng = 200 + usable:false +
   * reason — màn phải nói đúng câu ("hết hạn ngày X" ≠ "đã dùng rồi"), gộp
   * chung 404 là người thân không biết phải xin lại link hay thôi.
   */
  .get("/invites/:token", publicLimit, async (c) => {
    const invite = await repo.findByToken(c.req.param("token"));
    if (!invite) throw new HTTPException(404, { message: "INVITE_NOT_FOUND" });

    const now = new Date();
    const shape = {
      label: invite.label,
      status: invite.status as InviteStatus,
      expiresAt: invite.expiresAt,
    };
    // `viewer` CHỈ khi có phiên — response công khai giữ NGUYÊN shape (test
    // key-list của publicInviteView vẫn là hàng rào chống rò). Trang accept cần
    // hai câu trả lời mà đường public không được phép mang: "link này của CHÍNH
    // ví tôi à?" (chặn tự-làm-guardian) và "token đã dùng bởi TÔI à?" (màn
    // "xong rồi" thay vì "link đã dùng" lạnh lùng).
    const viewer = c.get("user");
    const acceptedByMe = viewer !== null && invite.acceptedByUserId === viewer.id;
    // owner_name: link sống — như cũ; link đã dùng bởi CHÍNH người xem — vẫn cần
    // tên để nói "bạn là người bảo hộ ví của <tên>".
    const ownerName =
      isUsable(shape, now) || acceptedByMe ? await repo.findOwnerName(invite.walletId) : null;
    const data = publicInviteView(shape, ownerName, now);
    if (!viewer) return c.json({ data });
    const isOwner = (await repo.walletOwnedBy(invite.walletId, viewer.id)) !== null;
    return c.json({
      data: {
        ...data,
        ...(acceptedByMe && ownerName ? { owner_name: ownerName } : {}),
        viewer: { is_owner: isOwner, accepted_by_me: acceptedByMe },
      },
    });
  })

  /**
   * Người được mời nộp ĐỊA CHỈ ví của họ (đã tạo passkey + deploy trên máy HỌ).
   * Cần đăng nhập: địa chỉ phải gắn với một người thật để chủ ví biết ai là ai.
   */
  .post("/invites/:token/accept", requireAuth, publicLimit, zv("json", acceptBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const invite = await repo.findByToken(c.req.param("token"));
    if (
      !invite ||
      !isUsable({ status: invite.status as InviteStatus, expiresAt: invite.expiresAt }, new Date())
    ) {
      throw new HTTPException(404, { message: "INVITE_NOT_USABLE" });
    }
    // Chủ ví tự nhận lời mời của chính mình = tự làm người bảo hộ cho mình —
    // mất máy là mất luôn "người cứu". Contract chỉ chặn được ĐỊA CHỈ trùng ví,
    // mà danh tính guardian tạo mới là địa chỉ KHÁC, nên phải chặn theo NGƯỜI
    // tại đây. BE là lớp thật; FE chỉ hiện câu tử tế.
    if ((await repo.walletOwnedBy(invite.walletId, user.id)) !== null) {
      throw new HTTPException(409, { message: "GUARDIAN_IS_OWNER" });
    }
    // Người thắng cuộc đua là người ghi ĐẦU TIÊN, quyết ở tầng DB. Kiểm trạng
    // thái phía trên chỉ để trả lỗi đẹp — nó không chống được hai request
    // đồng thời (cả hai cùng đọc thấy `sent`).
    const claimed = await repo.markDeployed({
      id: invite.id,
      userId: user.id,
      guardianAddress: body.guardian_address,
      now: new Date(),
    });
    if (!claimed) throw new HTTPException(409, { message: "INVITE_ALREADY_ACCEPTED" });
    // Realtime cho CHỦ VÍ — trước đây phải F5 mới thấy "Anh ba đã nhận lời".
    // Payload chỉ có nhãn chủ ví tự đặt; địa chỉ guardian KHÔNG đi qua đây.
    const ownerUserId = await repo.findOwnerUserId(invite.walletId);
    if (ownerUserId) {
      publishDomainEvent(ownerUserId, "guardian.accepted", { label: invite.label });
    }
    return c.json({ data: { status: "deployed" } });
  })

  /**
   * Chủ ví "Thêm vào ví" — chốt invite + ghi dòng `guardians` (nguồn khoá cho
   * `register_wallet`). Mỗi nguyên nhân từ chối một MÃ RIÊNG: một câu lỗi chung
   * cho nhiều nguyên nhân là người dùng không biết phải làm gì (bug 28/07).
   */
  .post("/invites/registered", requireAuth, zv("json", registeredBody), async (c) => {
    const user = requireUser(c);
    const { invite_id } = c.req.valid("json");
    const invite = await repo.findById(invite_id);
    if (!invite) throw new HTTPException(404, { message: "INVITE_NOT_FOUND" });
    const wallet = await ownedWallet(invite.walletId, user.id);
    if (invite.status !== "deployed" || !invite.acceptedByUserId || !invite.guardianAddress) {
      throw new HTTPException(409, { message: "INVITE_NOT_DEPLOYED" });
    }
    // Vòng chặn tự-mình thứ hai (accept đã chặn; dữ liệu cũ có thể lọt qua trước
    // khi vòng một tồn tại): theo NGƯỜI lẫn theo ĐỊA CHỈ trùng ví.
    if (invite.acceptedByUserId === user.id || invite.guardianAddress === wallet.stellarAddress) {
      throw new HTTPException(409, { message: "GUARDIAN_IS_OWNER" });
    }
    // Cùng một danh tính không được đếm hai lần — contract cũng sẽ chối
    // `DuplicateGuardian`, nhưng chặn ở đây mới nói được câu đúng cho người dùng.
    if ((await repo.guardianByKey(wallet.id, invite.guardianAddress)) !== null) {
      throw new HTTPException(409, { message: "GUARDIAN_ALREADY_ADDED" });
    }
    await repo.registerInviteAsGuardian({ invite, now: new Date() });
    // Hai đầu cùng thấy ngay: chủ ví (máy khác của họ) + người bảo hộ vừa vào
    // ví (màn /protecting của HỌ có thêm một ví để trông).
    publishDomainEvent(user.id, "guardian.added", { label: invite.label });
    publishDomainEvent(invite.acceptedByUserId, "guardian.added", { label: invite.label });
    return c.json({ data: { status: "registered" } });
  });
