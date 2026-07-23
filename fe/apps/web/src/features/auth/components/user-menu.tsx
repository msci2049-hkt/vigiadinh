import { defaultPanelPath, panelsForRole, sessionQueryKey } from "@repo/auth";
import { Button } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { signOut } from "@/lib/auth-client";
import { useCurrentUser } from "../hooks/use-current-user";

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
    await signOut();
    // Session gone → guards must re-check on next navigation.
    queryClient.removeQueries({ queryKey: sessionQueryKey });
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
      <Button size="sm" variant="ghost" onClick={handleSignOut}>
        {t("userMenu.logout")}
      </Button>
    </div>
  );
}
