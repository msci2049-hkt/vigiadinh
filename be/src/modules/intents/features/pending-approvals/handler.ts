// GET /api/intents/pending-approvals — hộp phiếu chờ của guardian ĐANG ĐĂNG
// NHẬP (LÔ 1 A5, lỗ thứ ba: trước đây guardian không có cách nào khám phá lệnh
// chờ mình duyệt). Response qua view thuần + key-list test (khuôn list-protecting).
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { pendingApprovalsForGuardianUser } from "../../infra/approvals.repository";
import { pendingApprovalView } from "./domain";

export const pendingApprovalsRoute = new Hono().get(
  "/pending-approvals",
  requireAuth,
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const rows = await pendingApprovalsForGuardianUser(user.id, new Date());
    return c.json({ data: rows.map(pendingApprovalView) });
  },
);
