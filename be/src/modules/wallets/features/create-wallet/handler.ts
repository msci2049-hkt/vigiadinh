// POST /api/wallets — mirror ví smart account FE đã deploy (setup mức A).
// BE KHÔNG deploy/không giữ khoá: chỉ ghi ví C… thuộc user (custody trên chuỗi).
// Idempotent theo địa chỉ: gọi lại cùng address của CHÍNH user → trả bản cũ;
// address đã thuộc user KHÁC → 409 (địa chỉ contract là duy nhất, unique index).
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import * as policyRepo from "../../infra/wallet-policies.repository";
import * as repo from "../../infra/wallets.repository";
import { createWalletBody } from "./dto";

const createLimit = rateLimit({
  points: 5,
  duration: 60,
  keyPrefix: "wallet-create",
  failOpen: false,
});

export const createWalletRoute = new Hono().post(
  "/",
  requireAuth,
  createLimit,
  zv("json", createWalletBody),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const body = c.req.valid("json");

    const existing = await repo.findByAddress(body.stellar_address);
    if (existing) {
      if (existing.userId !== user.id) {
        throw new HTTPException(409, { message: "WALLET_ADDRESS_TAKEN" });
      }
      return c.json({ data: existing }, 200); // idempotent — bản cũ của chính user
    }

    const wallet = await repo.insert({
      userId: user.id,
      stellarAddress: body.stellar_address,
      contractId: body.stellar_address,
      timezone: body.timezone,
    });
    // A2 lô policy — ngưỡng mềm mặc định (1.000/10.000 XLM) sinh CÙNG ví; lỗi ở
    // đây không được giết việc tạo ví (engine tự fallback default khi thiếu bản ghi).
    await policyRepo.ensureActivePolicy(wallet.id, user.id).catch(() => {});
    return c.json({ data: wallet }, 201);
  },
);
