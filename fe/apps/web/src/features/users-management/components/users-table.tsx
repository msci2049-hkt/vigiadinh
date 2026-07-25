import { useTranslation } from "react-i18next";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/family/icons";
import {
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/family/ui";
import type { AdminUser } from "../api/admin-users-api";
import type { useUsersTable } from "../hooks/use-users-table";
import { UserRowActions } from "./user-row-actions";

const SORTABLE: ReadonlyArray<{ column: string; labelKey: string }> = [
  { column: "name", labelKey: "users.columns.name" },
  { column: "email", labelKey: "users.columns.email" },
  { column: "createdAt", labelKey: "users.columns.createdAt" },
];

/** Presentational table — ALL data ops (sort/filter/page) happen server-side. */
export function UsersTable({ table }: { table: ReturnType<typeof useUsersTable> }) {
  const { t } = useTranslation("admin");
  const { users, query, sortBy, sortDirection, toggleSort } = table;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {SORTABLE.map(({ column, labelKey }) => (
              <TableHead key={column}>
                <button
                  type="button"
                  onClick={() => toggleSort(column)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {t(labelKey, { defaultValue: labelKey })}
                  {sortBy === column ? (
                    sortDirection === "asc" ? (
                      <ArrowUpIcon className="size-3" />
                    ) : (
                      <ArrowDownIcon className="size-3" />
                    )
                  ) : null}
                </button>
              </TableHead>
            ))}
            <TableHead>{t("users.columns.role")}</TableHead>
            <TableHead>{t("users.columns.status")}</TableHead>
            <TableHead className="w-10 text-right">{t("users.columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isPending ? (
            <SkeletonRows />
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                {t("users.empty")}
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => <UserRow key={user.id} user={user} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const { t } = useTranslation("admin");
  return (
    <TableRow data-testid={`user-row-${user.email}`}>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString("vi-VN")}
      </TableCell>
      <TableCell>
        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
          {user.role ?? "user"}
        </Badge>
      </TableCell>
      <TableCell>
        {user.banned ? (
          <Badge variant="destructive">{t("users.status.banned")}</Badge>
        ) : (
          <Badge variant="outline">{t("users.status.active")}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <UserRowActions user={user} />
      </TableCell>
    </TableRow>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <TableRow key={i}>
          <TableCell colSpan={6}>
            <Skeleton className="h-6 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/** Pagination footer: page x/y + prev/next (server-side offset). */
export function UsersTablePagination({ table }: { table: ReturnType<typeof useUsersTable> }) {
  const { t } = useTranslation("admin");
  const { page, pageCount, setPage, total, query } = table;

  return (
    <div className="flex items-center justify-between text-muted-foreground text-sm">
      <span>{t("users.total", { count: total })}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0 || query.isFetching}
          onClick={() => setPage(page - 1)}
        >
          {t("users.prev")}
        </Button>
        <span className="tabular-nums">
          {page + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= pageCount || query.isFetching}
          onClick={() => setPage(page + 1)}
        >
          {t("users.next")}
        </Button>
      </div>
    </div>
  );
}
