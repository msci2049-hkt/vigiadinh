// DTO SEP-45 — validate input bằng Zod (luật: validate mọi input).
import { z } from "zod";

const contractAddress = z
  .string()
  .regex(/^C[A-Z2-7]{55}$/, "account phải là địa chỉ ví contract (C...)");

export const challengeQuery = z.object({
  account: contractAddress,
  home_domain: z.string().min(1).max(253).optional(),
  // client_domain (SEP-45 optional) CHƯA hỗ trợ — nhận là từ chối rõ ràng, không im lặng.
  client_domain: z.string().optional(),
  // Bind thiết bị vào JWT (checklist 2.3): id ổn định do FE sinh per-install.
  device_id: z.string().min(8).max(128).optional(),
});
export type ChallengeQuery = z.infer<typeof challengeQuery>;

export const tokenBody = z.object({
  authorization_entries: z.string().min(1).max(65536),
});
export type TokenBody = z.infer<typeof tokenBody>;
