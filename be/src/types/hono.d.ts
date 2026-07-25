// WHY: Không có file này → `c.get("user")` / `c.get("session")` trả `unknown`
// khắp nơi, mọi handler phải tự cast → mất type-safe, dễ leak null check.
// Theo .claude/rules/auth.md.
//
// `typeof auth.$Infer.Session` tự sync khi `src/lib/auth.ts` thêm
// additionalFields hoặc plugin (organization, twoFactor…) — không cần đụng
// file này.
import type { auth } from "@/lib/auth";
import type { Logger } from "@/lib/logger";
import type { WalletJwtClaims } from "@/modules/sep45";

type S = typeof auth.$Infer.Session;

declare module "hono" {
  interface ContextVariableMap {
    user: S["user"] | null;
    session: S["session"] | null;
    // Active org id từ Better Auth organization plugin (nếu bật ở phase sau).
    // Null khi user chưa chọn org hoặc plugin chưa enable.
    activeOrgId: string | null;
    // Raw request body — set bởi captureRawBody middleware để verify HMAC
    // webhook. Không phải request nào cũng có (chỉ POST/PUT/PATCH).
    rawBody: string;
    // Per-request: ulid hoặc x-request-id từ client. Set ở app.ts trước
    // mọi middleware khác để trace xuyên log + Sentry.
    requestId: string;
    // Child logger đã bind reqId — middleware/handler dùng c.var.log thay
    // vì import logger toàn cục để log tự có reqId.
    log: Logger;
    // Phiên VÍ (SEP-45) đã qua kiểm thu hồi `jwt_version` — set bởi middleware
    // walletSession. Null = request không mang JWT ví (KHÔNG phải "chưa auth":
    // danh tính cấp quyền vẫn là c.var.user). Token ví đã thu hồi không bao giờ
    // tới được handler — middleware ném 401 trước.
    walletSession: WalletJwtClaims | null;
  }
}
