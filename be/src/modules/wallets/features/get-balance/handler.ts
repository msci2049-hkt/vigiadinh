// GET /api/wallets/:id/balance — audit 2026-07-25 §8.
//
// Vì sao endpoint này phải tồn tại: logic đọc số dư ĐÃ có từ PHA 6, nhưng chỉ nằm
// bên trong `POST /api/intents/send/prepare`. Nghĩa là muốn xem số dư, client phải
// gọi một endpoint ĐỔI TRẠNG THÁI — nó tạo/dedup một dòng intent và đẩy intent qua
// draft → validating → review, đồng thời đốt một điểm trong hạn mức 10/60s của
// luồng gửi tiền. Một cái ví mà không xem được số dư ngoài lúc chuyển tiền thì
// không dùng được, và FE đã khai "chưa có màn số dư (BE chưa có endpoint)".
//
// Ở đây là đường ĐỌC thuần: không ghi DB, không tạo intent, không đụng hạn mức gửi.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "@/env";
import { requireAuth } from "@/middlewares/auth";
import { rateLimit } from "@/middlewares/rate-limit";
import { zv } from "@/middlewares/validator";
import { readBalance, type SendGateway } from "@/modules/intents";
import { StellarServiceError, simulateRead } from "@/services/stellar/stellar.service";
import { walletIdParam } from "../../domain/validators";
import * as repo from "../../infra/wallets.repository";

// Chỉ cần `read` — endpoint này KHÔNG được phép dựng hay nộp tx. Hai field kia để
// undefined là cố ý: nếu ai đó sau này gọi nhầm build/invoke ở đây thì nổ ngay tại
// chỗ chứ không âm thầm ký một giao dịch trên đường "xem số dư".
const readOnlyGateway = { read: simulateRead } as Pick<SendGateway, "read"> as SendGateway;

/** SAC native chưa cấu hình → 503 (app sống, module khác chạy — pattern send/recovery). */
function sacContractId(): string {
  if (!env.CONTRACT_ID_SAC_NATIVE) {
    throw new HTTPException(503, { message: "BALANCE_NOT_CONFIGURED" });
  }
  return env.CONTRACT_ID_SAC_NATIVE;
}

export const getBalanceRoute = new Hono().get(
  "/:id/balance",
  requireAuth,
  // RPC ngoài + không cache → có trần riêng, tách khỏi hạn mức `send` để xem số dư
  // không ăn vào quota chuyển tiền. failOpen:false như mọi limiter khác trong repo.
  rateLimit({ points: 30, duration: 60, keyPrefix: "wallet-balance", failOpen: false }),
  zv("param", walletIdParam),
  async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const { id } = c.req.valid("param");

    // Ownership từ DB, không từ claim (§3). Ví không thuộc người gọi → 404, không
    // 403: không xác nhận ví đó có tồn tại hay không.
    const wallet = await repo.findByIdForUser(id, user.id);
    if (!wallet) throw new HTTPException(404, { message: "WALLET_NOT_FOUND" });

    let balance: bigint;
    try {
      balance = await readBalance(readOnlyGateway, sacContractId(), wallet.stellarAddress);
    } catch (err) {
      // RPC chết → 503 tạm thời, KHÔNG 500: số dư không đọc được là sự cố hạ tầng
      // chứ không phải lỗi request, và client nên thử lại.
      if (err instanceof StellarServiceError) {
        throw new HTTPException(503, { message: "BALANCE_UNREADABLE" });
      }
      throw err;
    }

    // Số dư là dữ liệu tiền, thay đổi mọi lúc: cấm mọi tầng cache giữ lại.
    c.header("Cache-Control", "no-store");
    return c.json({
      data: {
        wallet_id: wallet.id,
        address: wallet.stellarAddress,
        // Chuỗi, không number: stroops là i128 on-chain, vượt Number.MAX_SAFE_INTEGER
        // là mất chữ số câm lặng — đúng kiểu lỗi làm lệch sổ mà không ai thấy.
        balance: balance.toString(),
        asset: "native",
      },
    });
  },
);
