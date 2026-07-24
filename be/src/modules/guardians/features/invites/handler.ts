// Luồng MỜI người bảo hộ (wizard mức B — luồng tăng dần).
//
// Kiến trúc: chủ ví đã có ví CHẠY ĐƯỢC từ bước 1-2. Mời là chuỗi thao tác MỘT
// BÊN nối tiếp, không phải một giao dịch đa bên:
//   1. chủ ví tạo lời mời          → POST /invites          (tx: không)
//   2. người được mời mở link      → GET  /invites/:token   (public, chỉ đọc nhãn)
//   3. họ tạo passkey + deploy ví CỦA HỌ trên máy HỌ, nộp ĐỊA CHỈ
//                                   → POST /invites/:token/accept
//   4. chủ ví ký `add_guardian`    → recovery /add-guardian + /submit (tx riêng)
//   5. đánh dấu đã lên chain       → POST /invites/:id/registered
//
// BẤT BIẾN (cưỡng chế ở đây, ghi trong THREAT-MODEL):
//   · Backend KHÔNG BAO GIỜ sinh khoá hộ người bảo hộ.
//   · Người bảo hộ KHÔNG BAO GIỜ gửi private key lên server — cột duy nhất
//     nhận được là `guardian_address` (C…, công khai trên chain).
import { zValidator as zv } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import * as repo from "../../infra/invites.repository";
import { INVITE_TTL_MS, type InviteStatus, isUsable, recoverability } from "./domain";

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

  /** PUBLIC — người được mời mở link, chỉ thấy nhãn + tên ví, không thấy gì khác. */
  .get("/invites/:token", publicLimit, async (c) => {
    const invite = await repo.findByToken(c.req.param("token"));
    if (
      !invite ||
      !isUsable({ status: invite.status as InviteStatus, expiresAt: invite.expiresAt }, new Date())
    ) {
      throw new HTTPException(404, { message: "INVITE_NOT_USABLE" });
    }
    return c.json({ data: { label: invite.label, status: invite.status } });
  })

  /**
   * Người được mời nộp ĐỊA CHỈ ví của họ (đã tạo passkey + deploy trên máy HỌ).
   * Cần đăng nhập: địa chỉ phải gắn với một người thật để chủ ví biết ai là ai.
   */
  .post("/invites/:token/accept", requireAuth, zv("json", acceptBody), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const invite = await repo.findByToken(c.req.param("token"));
    if (
      !invite ||
      !isUsable({ status: invite.status as InviteStatus, expiresAt: invite.expiresAt }, new Date())
    ) {
      throw new HTTPException(404, { message: "INVITE_NOT_USABLE" });
    }
    await repo.markDeployed({
      id: invite.id,
      userId: user.id,
      guardianAddress: body.guardian_address,
      now: new Date(),
    });
    return c.json({ data: { status: "deployed" } });
  })

  /** Chủ ví xác nhận đã ký `add_guardian` xong — mirror trạng thái cuối. */
  .post("/invites/registered", requireAuth, zv("json", registeredBody), async (c) => {
    const user = requireUser(c);
    const { invite_id } = c.req.valid("json");
    const invite = await repo.findById(invite_id);
    if (!invite) throw new HTTPException(404, { message: "INVITE_NOT_FOUND" });
    await ownedWallet(invite.walletId, user.id);
    if (invite.status !== "deployed") {
      throw new HTTPException(409, { message: "INVITE_NOT_DEPLOYED" });
    }
    await repo.markRegistered(invite.id, new Date());
    return c.json({ data: { status: "registered" } });
  });
