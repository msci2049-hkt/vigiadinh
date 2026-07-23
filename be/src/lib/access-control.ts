// ============================================================================
// Access control cho Better Auth admin plugin — NGUỒN SERVER.
//
// ⚠️ PHẢI MIRROR FRONTEND: mau-demo-fe-vite/packages/auth/src/access-control.ts
// khai báo ĐÚNG statements/roles này cho adminClient({ ac, roles }). Thêm role
// hay statement ở đây thì thêm y hệt bên FE (và ngược lại) — lệch nhau = client
// cho phép thao tác server từ chối (hoặc tệ hơn: ẩn thao tác server cho phép).
//
// Thêm panel/role mới: xem mau-demo-fe-vite/docs/ADD-NEW-PANEL.md (3 bước).
// ============================================================================
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/** Resource → actions. Bắt đầu = defaults của admin plugin (user/session). */
export const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

/** `admin` thừa hưởng toàn bộ quyền admin plugin; `user` không có quyền nào
 * (mảng RỖNG cho từng resource — role không statement nào phá type variance). */
export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
  }),
  user: ac.newRole({
    user: [],
    session: [],
  }),
} as const;

export type AppRole = keyof typeof roles;
