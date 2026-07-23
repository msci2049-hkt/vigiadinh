// WHY: Middleware THROW HTTPException, KHÔNG `return c.json(..., 401)` —
// return bypass global onError → mất observability + response shape lệch.
// Service throw domain string (UNAUTHENTICATED, FORBIDDEN_ROLE...), route
// không tự map status. Theo .claude/rules/auth.md.
import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "@/lib/logger";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!c.get("user")) {
    throw new HTTPException(401, { message: "UNAUTHENTICATED" });
  }
  await next();
};

// Role từ Better Auth ADMIN PLUGIN (user.role — bật 2026-07-08, xem
// lib/auth.ts + lib/access-control.ts). User cũ trước migration có role NULL
// → fallback "user" (deny mặc định với requireRole("admin")).
type Role = "admin" | "user";

export const requireRole = (...allowed: Role[]): MiddlewareHandler => {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw new HTTPException(401, { message: "UNAUTHENTICATED" });
    const role = user.role ?? "user";
    if (!allowed.some((r) => r === role)) {
      logger.warn({ userId: user.id, role, allowed }, "rbac.denied");
      throw new HTTPException(403, { message: "FORBIDDEN_ROLE" });
    }
    await next();
  };
};

// Đọc activeOrganizationId từ session (Better Auth organization plugin).
// Plugin chưa enable → field undefined → 403. Set c.var.activeOrgId cho
// handler dùng (đã augment ở src/types/hono.d.ts).
export const requireOrg: MiddlewareHandler = async (c, next) => {
  const session = c.get("session");
  const orgId = (session as unknown as { activeOrganizationId?: string } | null)
    ?.activeOrganizationId;
  if (!orgId) {
    logger.warn({ userId: c.get("user")?.id }, "org.no-active");
    throw new HTTPException(403, { message: "NO_ACTIVE_ORG" });
  }
  c.set("activeOrgId", orgId);
  await next();
};

// Helper, KHÔNG phải middleware — ownership cần resource đã load. Gọi trong
// handler SAU khi service.getById(). Throw HTTPException để global onError
// map → 403.
export function assertOwnership(
  resource: { ownerId?: string | null; userId?: string | null },
  userId: string,
  ctx?: Context,
): void {
  const ownerId = resource.ownerId ?? resource.userId;
  if (ownerId !== userId) {
    if (ctx) {
      logger.warn({ ownerId, userId, path: ctx.req.path }, "ownership.denied");
    }
    throw new HTTPException(403, { message: "NOT_OWNER" });
  }
}
