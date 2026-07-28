import { defaultPanelPath, panelsForRole } from "@repo/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/family/ui";
import { useCurrentUser } from "../hooks/use-current-user";
import { performSignOut } from "../lib/sign-out-cleanup";

export function UserMenu() {
  const { user, isPending } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("common");

  if (isPending) {
    return <span className="text-muted-foreground text-sm">…</span>;
  }

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/login">{t("userMenu.login")}</Link>
      </Button>
    );
  }

  async function handleSignOut() {
    // Dọn TRỌN VẸN: phiên app + phiên ví + toàn bộ query cache (logout xoá
    // thật — không để dữ liệu ví của người này sống sang phiên người sau).
    await performSignOut(queryClient);
    await navigate({ to: "/" });
  }

  const panelPath = panelsForRole(user.role).length > 0 ? defaultPanelPath(user.role) : null;

  return (
    <div className="flex items-center gap-2">
      {panelPath ? (
        <Button asChild size="sm" variant="outline">
          <Link to={panelPath}>{t("userMenu.panel")}</Link>
        </Button>
      ) : null}
      <span className="hidden text-sm sm:inline">{user.name ?? user.email}</span>
      <Button asChild size="sm" variant="ghost">
        <Link to="/settings">{t("userMenu.settings")}</Link>
      </Button>
      <Button size="sm" variant="ghost" onClick={handleSignOut}>
        {t("userMenu.logout")}
      </Button>
    </div>
  );
}
