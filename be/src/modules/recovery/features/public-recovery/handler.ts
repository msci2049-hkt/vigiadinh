// Luồng khôi phục PUBLIC (PHA 6 cụm GHI) — hai cửa KHÔNG auth (người mất máy
// chưa có session), cả hai rate-limit chặt failOpen=false:
//
// POST /public/device-request — thiết bị mới "gõ cửa": nộp vật liệu khoá mới.
//   Server CHỈ chuyển lời + notify guardian; không sinh/giữ/ký khoá (bất biến 2).
//   Anti-enumeration: ví không tồn tại vẫn trả 200 accepted (như forget-password).
// GET  /public/progress?address=… — tiến độ khôi phục từ mirror (dữ liệu vốn
//   public trên chain); không lộ id nội bộ hay thông tin chủ ví.
import { createHash } from "node:crypto";
import { Hono } from "hono";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import { externalSignerScVal, RecoveryOnchainError } from "../../domain/onchain";
import * as repo from "../../infra/recovery.repository";
import { deviceRequestBody, progressQuery } from "./dto";

// Cửa public → spam surface: limit rất chặt, Dragonfly chết thì CHẶN (failOpen=false).
const publicLimit = rateLimit({
  points: 5,
  duration: 60,
  keyPrefix: "recovery-public",
  failOpen: false,
});

/** Fingerprint sha256 hex của Signer ScVal — TRÙNG công thức contract. */
export function signerFingerprintHex(input: { verifier: string; keyBase64: string }): string {
  const scval = externalSignerScVal(input);
  return createHash("sha256").update(new Uint8Array(scval.toXDR())).digest("hex");
}

export const publicRecoveryRoute = new Hono()
  .post("/public/device-request", publicLimit, zv("json", deviceRequestBody), async (c) => {
    const body = c.req.valid("json");
    let fingerprint: string;
    try {
      fingerprint = signerFingerprintHex({
        verifier: body.verifier,
        keyBase64: body.key_base64,
      });
    } catch (err) {
      if (err instanceof RecoveryOnchainError) {
        return c.json({ error: { code: err.message, message: err.message } }, 400);
      }
      throw err;
    }
    // Ví lạ → vẫn 200 accepted (không lộ ví nào tồn tại). Fingerprint trả về
    // để MÀN THIẾT BỊ MỚI hiện cho chủ ví đọc qua điện thoại với guardian.
    const wallet = await repo.walletByStellarAddress(body.wallet_address);
    if (wallet) {
      await repo.upsertDeviceRequest({
        walletId: wallet.id,
        verifier: body.verifier,
        keyBase64: body.key_base64,
        fingerprint,
      });
      await repo.notifyGuardiansDeviceRequested(wallet.id);
    }
    return c.json({ data: { accepted: true, fingerprint } });
  })
  .get("/public/progress", publicLimit, zv("query", progressQuery), async (c) => {
    const { address } = c.req.valid("query");
    const progress = await repo.publicProgressByAddress(address);
    // Không có gì đang mở (hoặc ví lạ) → cùng MỘT shape "none" — không phân biệt được.
    return c.json({ data: progress ?? { status: "none" } });
  });
