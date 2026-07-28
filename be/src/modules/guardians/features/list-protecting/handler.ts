// Chiều NGƯỢC của list-guardians: guardian xem các ví MÌNH đang gác (C7 —
// màn "Ví tôi đang gác"). Response đi qua protectingItemView — key-list test
// chốt cứng không rò email / địa chỉ ví / số dư của chủ ví sang chiều này.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import * as repo from "../../infra/guardians.repository";
import { protectingItemView } from "./domain";

export const listProtectingRoute = new Hono().get("/protecting", requireAuth, async (c) => {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  const rows = await repo.listProtectingForUser(user.id);
  return c.json({ data: rows.map(protectingItemView) });
});
