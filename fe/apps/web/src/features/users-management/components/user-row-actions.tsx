import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/lib/auth-client";
import type { AdminUser } from "../api/admin-users-api";
import { useUserMutations } from "../hooks/use-user-mutations";
import { BanUserDialog, RemoveUserDialog, SetPasswordDialog, SetRoleDialog } from "./user-dialogs";

type DialogKind = "role" | "ban" | "password" | "remove" | null;

/**
 * Row actions: set role / ban–unban / set password / revoke sessions /
 * impersonate / remove. Actions on YOURSELF are disabled — the BE would refuse
 * anyway; disabling avoids a confusing round-trip error.
 */
export function UserRowActions({ user }: { user: AdminUser }) {
  const { t } = useTranslation("admin");
  // lib-layer session (NOT features/auth) — features must not cross-import.
  const { data: session } = useSession();
  const mutations = useUserMutations();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const isSelf = session?.user.id === user.id;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("users.actions.menu", { email: user.email })}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="max-w-48 truncate">{user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={isSelf} onSelect={() => setDialog("role")}>
            {t("users.actions.setRole")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("password")}>
            {t("users.actions.setPassword")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => mutations.revokeSessions.mutate(user.id)}
          >
            {t("users.actions.revokeSessions")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSelf || Boolean(user.banned)}
            onSelect={() => mutations.impersonate.mutate(user.id)}
          >
            {t("users.actions.impersonate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {user.banned ? (
            <DropdownMenuItem disabled={isSelf} onSelect={() => mutations.unban.mutate(user.id)}>
              {t("users.actions.unban")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={isSelf} onSelect={() => setDialog("ban")}>
              {t("users.actions.ban")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            disabled={isSelf}
            onSelect={() => setDialog("remove")}
          >
            {t("users.actions.remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SetRoleDialog
        user={user}
        open={dialog === "role"}
        onOpenChange={(open) => setDialog(open ? "role" : null)}
        mutations={mutations}
      />
      <BanUserDialog
        user={user}
        open={dialog === "ban"}
        onOpenChange={(open) => setDialog(open ? "ban" : null)}
        mutations={mutations}
      />
      <SetPasswordDialog
        user={user}
        open={dialog === "password"}
        onOpenChange={(open) => setDialog(open ? "password" : null)}
        mutations={mutations}
      />
      <RemoveUserDialog
        user={user}
        open={dialog === "remove"}
        onOpenChange={(open) => setDialog(open ? "remove" : null)}
        mutations={mutations}
      />
    </>
  );
}
