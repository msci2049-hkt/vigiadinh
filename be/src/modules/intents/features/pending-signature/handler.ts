// GET /api/intents/pending-signature — lệnh của CHỦ VÍ đang chờ chính họ ký
// (lô vá L2 2026-07-30, lỗ đối xứng với /pending-approvals của guardian).
//
// Trước lô này: guardian bấm duyệt → intent sang `awaiting_signature` → im.
// Chủ ví nhận thông báo "đã duyệt" nhưng không có màn nào, không có route nào
// dẫn tới bước ký; đóng tab là mất `intentId` vĩnh viễn. Route này là đường
// khám phá lại — chỉ ĐỌC, không đổi trạng thái gì.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { walletScopeAllows } from "@/lib/wallet-scope";
import { requireAuth } from "@/middlewares/auth";
import { intentsAwaitingSignatureForOwner } from "../../infra/signing.repository";
import { pendingSignatureView } from "./domain";

export const pendingSignatureRoute = new Hono().get(
  "/pending-signature",
  requireAuth,
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const rows = await intentsAwaitingSignatureForOwner(user.id, new Date());
    // Session passkey scope vào ví A không được thấy lệnh của ví B cùng tài
    // khoản (lib/wallet-scope). LỌC thay vì ném 403: người dùng có 2 ví thì
    // danh sách phải trả đúng phần họ đang cầm chìa, không phải chết cả cửa.
    // (Cửa GHI — /send/:id/signable, /send/sign — vẫn ném 403 như cũ.)
    const session = c.get("session");
    const scoped = rows.filter((r) => walletScopeAllows(session, r.walletId));
    return c.json({ data: scoped.map(pendingSignatureView) });
  },
);
