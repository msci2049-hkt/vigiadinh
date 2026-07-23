// ============================================================================
// ROLE-PANEL REGISTRY — "thêm bảng điều khiển cho role mới = 3 bước cơ học":
//   1. access-control.ts: thêm role (ac.newRole(...)).
//   2. PANELS: thêm 1 object bên dưới.
//   3. Copy route group apps/web/src/app/routes/_authenticated/_admin/ →
//      _<role>/, đổi requireRoles([...]) + pages. (docs/ADD-NEW-PANEL.md)
// Không đụng core/shell/auth-client. CLIENT-SAFE — chỉ data, không import gì.
// ============================================================================

export interface PanelNavItem {
  to: string;
  /** i18n key in the `common` namespace (the shell renders before lazy namespaces load). */
  labelKey: string;
}

export interface PanelDef {
  key: string;
  /** Roles allowed in (must match access-control roles). */
  roles: readonly string[];
  /** Route-group base, e.g. "/admin". */
  basePath: string;
  labelKey: string;
  nav: readonly PanelNavItem[];
}

export const PANELS: readonly PanelDef[] = [
  {
    key: "admin",
    roles: ["admin"],
    basePath: "/admin",
    labelKey: "panels.admin.label",
    nav: [
      { to: "/admin", labelKey: "panels.admin.nav.overview" },
      { to: "/admin/users", labelKey: "panels.admin.nav.users" },
      { to: "/admin/sessions", labelKey: "panels.admin.nav.sessions" },
      { to: "/admin/settings", labelKey: "panels.admin.nav.settings" },
    ],
  },
  // ↓ thêm panel mới: 1 object ở đây, ví dụ:
  // {
  //   key: "moderator",
  //   roles: ["moderator", "admin"],
  //   basePath: "/moderator",
  //   labelKey: "panels.moderator.label",
  //   nav: [{ to: "/moderator", labelKey: "panels.moderator.nav.overview" }],
  // },
];

/** Panels the given role may enter (drives the shell's panel switcher). */
export function panelsForRole(role?: string | null): PanelDef[] {
  return PANELS.filter((p) => role != null && p.roles.includes(role));
}

/** Landing path after login: first panel of the role, else the public home. */
export function defaultPanelPath(role?: string | null): string {
  return panelsForRole(role)[0]?.basePath ?? "/";
}

export function panelByKey(key: string): PanelDef | undefined {
  return PANELS.find((p) => p.key === key);
}
