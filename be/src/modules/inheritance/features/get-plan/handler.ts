// Đọc THAM SỐ chu trình thừa kế của ví (owner-scoped) cho màn heartbeat + claim
// FE: im lặng bao lâu thì guardian ĐƯỢC GỢI Ý mở claim, timelock cuối, bậc leo
// thang hiện tại. KHÔNG kích hoạt gì — mở claim là hành động on-chain của guardian
// (bất biến 2). Trả null khi ví chưa có kế hoạch.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/inheritance.repository";

export const getPlanRoute = new Hono().get(
  "/wallet/:walletId/plan",
  requireAuth,
  zv("param", walletIdParam),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { walletId } = c.req.valid("param");
    const plan = await repo.getLatestPlanForOwner(walletId, user.id);
    if (!plan) return c.json({ data: null });
    return c.json({
      data: {
        id: plan.id,
        version: plan.version,
        inactivityPeriodSecs: plan.inactivityPeriodSecs,
        finalTimelockSecs: plan.finalTimelockSecs,
        status: plan.status,
        escalationTier: plan.escalationTier,
        updatedAt: plan.updatedAt.toISOString(),
      },
    });
  },
);
