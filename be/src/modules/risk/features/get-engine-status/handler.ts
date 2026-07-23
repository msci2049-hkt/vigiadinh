// KHUNG — risk engine = rules thuần (KHÔNG bảng riêng: score + signals ghi vào
// recovery_requests). Kill-switch AI_ENABLED=false phải để mọi luồng chạy đủ
// (rule security.md) — hiện chưa có env AI_ENABLED nên trả false cứng.
import { Hono } from "hono";
import { requireAuth } from "@/middlewares/auth";
import type { EngineStatusOutput } from "./dto";

export const getEngineStatusRoute = new Hono().get("/", requireAuth, (c) => {
  const status: EngineStatusOutput = { engine: "rules", aiEnabled: false };
  return c.json({ data: status });
});
