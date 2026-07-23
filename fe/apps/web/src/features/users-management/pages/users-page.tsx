import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { useTranslation } from "react-i18next";
import { CreateUserDialog } from "../components/create-user-dialog";
import { UsersTable, UsersTablePagination } from "../components/users-table";
import type { RoleFilter } from "../hooks/use-users-table";
import { useUsersTable } from "../hooks/use-users-table";

/** /admin/users — server-side data-table over Better Auth `listUsers`. */
export function UsersPage() {
  const { t } = useTranslation("admin");
  const table = useUsersTable();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl">{t("users.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("users.description")}</p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={table.search}
          onChange={(e) => table.setSearch(e.target.value)}
          placeholder={t("users.searchPlaceholder")}
          className="max-w-xs"
          aria-label={t("users.searchPlaceholder")}
        />
        <Select
          value={table.roleFilter}
          onValueChange={(v) => table.setRoleFilter(v as RoleFilter)}
        >
          <SelectTrigger size="sm" aria-label={t("users.roleFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.roleAll")}</SelectItem>
            <SelectItem value="admin">admin</SelectItem>
            <SelectItem value="user">user</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {table.query.isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive text-sm">
          {t("users.loadError")}{" "}
          {table.query.error instanceof Error ? table.query.error.message : ""}
        </p>
      ) : null}

      <UsersTable table={table} />
      <UsersTablePagination table={table} />
    </div>
  );
}
