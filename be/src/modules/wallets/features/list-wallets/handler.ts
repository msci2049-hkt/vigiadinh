// KHUNG (skeleton) — logic thật dựng theo skill fw-passkey-auth + fw-soroban-contracts.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import * as repo from "../../infra/wallets.repository";
import { listWalletsQuery } from "./dto";

export const listWalletsRoute = new Hono().get(
  "/",
  requireAuth,
  zv("query", listWalletsQuery),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { limit } = c.req.valid("query");
    const items = await repo.listByUser(user.id, limit);
    // Session passkey: ví ĐÃ KÝ đứng đầu — useActiveWallet của FE lấy wallets[0],
    // nên ký khoá nào là vào đúng ví đó (B1). CHỈ đổi thứ tự, KHÔNG lọc: lọc làm
    // luồng tạo-ví-thứ-hai mù (ví mới tạo không hiện ra vì scope còn trỏ ví cũ),
    // còn quyền HÀNH ĐỘNG trên ví khác đã bị chặn ở từng cửa ghi (wallet-scope).
    const scope = c.get("session")?.activeWalletId;
    if (scope) items.sort((a, b) => (a.id === scope ? -1 : b.id === scope ? 1 : 0));
    return c.json({ data: items });
  },
);
