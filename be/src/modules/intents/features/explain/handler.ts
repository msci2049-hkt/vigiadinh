// POST /api/intents/:intentId/explain — "AI bảo vệ" DIỄN ĐẠT tín hiệu lớp 2
// (lô R3). Trả `{ data: { text } }` với text = câu chữ + câu miễn trừ, hoặc
// `null` khi AI tắt/sập/quá hạn/trả rác — FE thấy null thì hiện khối số thô.
//
// Authz GIỐNG HỆT /signals (read-intent.ts): text chỉ là bản diễn đạt của
// signals, không được rộng cửa hơn số liệu gốc. Rate-limit per-user vì mỗi
// cache-miss là một lần gọi API trả tiền.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import { ownerNameForWallet } from "../../infra/approvals.repository";
import { computeIntentSignals, loadReadableIntent } from "../signals/read-intent";
import { realExplainDeps } from "./deps";
import { explainIntentSignals } from "./service";

const explainParam = z.object({ intentId: z.string().length(26) });
const explainBody = z.object({ locale: z.enum(["vi", "en", "zh"]).default("vi") });

const explainLimit = rateLimit({
  points: 10,
  duration: 60,
  keyPrefix: "intent-explain",
});

export const intentExplainRoute = new Hono().post(
  "/:intentId/explain",
  requireAuth,
  explainLimit,
  zv("param", explainParam),
  zv("json", explainBody),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { intentId } = c.req.valid("param");
    const { locale } = c.req.valid("json");

    const intent = await loadReadableIntent(intentId, user.id, c.get("session"));
    const signals = await computeIntentSignals(intent);
    const ownerName = await ownerNameForWallet(intent.walletId);

    const text = await explainIntentSignals(realExplainDeps(), {
      intentId,
      locale,
      signals,
      ownerName,
    });
    return c.json({ data: { text } });
  },
);
