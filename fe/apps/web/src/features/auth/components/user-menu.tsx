import { defaultPanelPath, panelsForRole } from "@repo/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/family/ui";
import { useCurrentUser } from "../hooks/use-current-user";
import { performSignOut } from "../lib/sign-out-cleanup";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, isPending } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("common");

  if (isPending) {
    return (
      <span
        className={compact ? "user-menu__pending" : "text-muted-foreground text-sm"}
        aria-hidden
      >
        …
      </span>
    );
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

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="user-menu__trigger"
            aria-label={t("userMenu.panel")}
          >
            <Icon name="user" size={20} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="user-menu__content">
          <DropdownMenuLabel className="user-menu__identity">
            {user.name ?? user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {panelPath ? (
            <DropdownMenuItem asChild>
              <Link to={panelPath}>
                <Icon name="wallet" size={20} />
                {t("userMenu.panel")}
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link to="/protecting">
              <Icon name="shieldCheck" size={20} />
              {t("userMenu.protecting")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Icon name="settings" size={20} />
              {t("userMenu.settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void handleSignOut()}>
            <Icon name="logOut" size={20} />
            {t("userMenu.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {panelPath ? (
        <Button asChild size="sm" variant="outline">
          <Link to={panelPath}>{t("userMenu.panel")}</Link>
        </Button>
      ) : null}
      <span className="hidden text-sm sm:inline">{user.name ?? user.email}</span>
      {/* C7 — lối vào duy nhất của màn "Ví tôi đang gác": không có mục này,
          người bảo hộ nhận email lúc recovery không biết bấm vào đâu. */}
      <Button asChild size="sm" variant="ghost">
        <Link to="/protecting">{t("userMenu.protecting")}</Link>
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link to="/settings">{t("userMenu.settings")}</Link>
      </Button>
      <Button size="sm" variant="ghost" onClick={handleSignOut}>
        {t("userMenu.logout")}
      </Button>
    </div>
  );
}
