import { requireRoles } from "@repo/auth";
import { createFileRoute } from "@tanstack/react-router";
import { PanelShell } from "@/components/panel-shell";

/**
 * PANEL "admin" — the first role panel (mẫu). New panel = copy this group,
 * change requireRoles + panelKey + pages (docs/ADD-NEW-PANEL.md, 3 steps).
 *
 * Route-guard ≠ data-auth: the BE admin plugin re-checks every admin API call;
 * this guard only keeps non-admins out of the UI shell.
 */
export const Route = createFileRoute("/_authenticated/_admin")({
  beforeLoad: requireRoles(["admin"]),
  component: AdminPanel,
});

function AdminPanel() {
  return <PanelShell panelKey="admin" />;
}
