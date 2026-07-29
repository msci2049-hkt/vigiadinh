// POST /api/intents — tạo draft idempotent (A3). Double-submit (50 request song
// song cùng client_intent_id) → MỘT bản ghi, các bản sau trả deduplicated=true
// (unique index DB là chốt; test integration bắn song song thật).
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertWalletScope } from "@/lib/wallet-scope";
import { requireAuth } from "@/middlewares/auth";
import { zv } from "@/middlewares/validator";
import * as repo from "../../infra/intents.repository";
import { createIntentInput } from "./dto";

export const createIntentRoute = new Hono().post(
  "/",
  requireAuth,
  zv("json", createIntentInput),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const input = c.req.valid("json");

    // Ownership lớp 2 (route guard chỉ là UX): ví phải của user đang đăng nhập.
    if (!(await repo.walletOwnedBy(input.wallet_id, user.id))) {
      throw new HTTPException(403, { message: "NOT_OWNER" });
    }
    // Scope session passkey: tạo lệnh cho ví B bằng chìa ví A bị chối
    // (lib/wallet-scope, lô passkey-là-chìa-khoá 29/07).
    assertWalletScope(c.get("session"), input.wallet_id);

    const { intent, deduplicated } = await repo.createIdempotent({
      walletId: input.wallet_id,
      clientIntentId: input.client_intent_id,
      createdBy: "owner", // đường AI tạo draft đi cổng riêng (PHA 6+), không qua đây
      operations: input.operations,
      recipient: input.recipient ?? null,
      amount: input.amount === undefined ? null : BigInt(input.amount),
    });
    return c.json(
      {
        data: {
          id: intent.id,
          status: intent.status,
          version: intent.version,
          expires_at: intent.expiresAt,
        },
        deduplicated,
      },
      deduplicated ? 200 : 201,
    );
  },
);
