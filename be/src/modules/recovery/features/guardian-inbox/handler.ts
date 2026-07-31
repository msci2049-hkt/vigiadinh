// Hộp thư guardian (PHA 6 cụm GHI): các yêu cầu khôi phục ĐANG MỞ trên ví mà
// user là người bảo hộ hiệu lực — nguồn cho màn /guardian (bỏ phiếu approve).
// Chỉ đọc mirror (indexer là người ghi duy nhất); phiếu thật đi đường
// /api/recovery/approve + /submit với chữ ký của guardian.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "@/middlewares/auth";
import * as repo from "../../infra/guardian-inbox.repository";

export const guardianInboxRoute = new Hono()
  .get("/guardian", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const items = await repo.openRequestsForGuardianUser(user.id);
    return c.json({ data: items });
  })
  // "Tiếng gõ cửa" từ thiết bị mới trên các ví mình bảo hộ — nguồn cho màn
  // initiate của guardian (xác minh fingerprint NGOÀI BĂNG rồi mới mở on-chain).
  .get("/guardian/device-requests", requireAuth, async (c) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const items = await repo.openDeviceRequestsForGuardianUser(user.id);
    return c.json({ data: items });
  });
