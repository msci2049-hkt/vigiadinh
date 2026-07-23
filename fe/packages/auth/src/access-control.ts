// ============================================================================
// Access control — CLIENT-SAFE (no server-only imports; bundled into apps).
//
// ⚠️ MUST MIRROR THE BACKEND: mau-demo-be/src/lib/access-control.ts defines the
// same statements/roles for the Better Auth admin() server plugin. If you add a
// role or statement here, add it there too (and vice versa) — drift means the
// client authorizes actions the server rejects (or worse, hides ones it allows).
// ============================================================================
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Resource → actions the app knows about. Start with Better Auth's admin
 * defaults (user/session management); append app resources as they appear:
 *   const statement = { ...defaultStatements, project: ["create", "share"] } as const;
 */
export const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

/**
 * Role definitions. `admin` inherits every admin-plugin permission (adminAc);
 * `user` gets none. New role = 1 entry here + 1 PANELS entry + 1 route group
 * (see docs/ADD-NEW-PANEL.md).
 */
export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
  }),
  // Mảng RỖNG cho từng resource (khớp userAc upstream) — role không có
  // statement nào sẽ phá type variance của admin({ roles }) phía BE.
  user: ac.newRole({
    user: [],
    session: [],
  }),
} as const;

export type AppRole = keyof typeof roles;
