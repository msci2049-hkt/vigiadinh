import { useDebouncedValue } from "@repo/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminUsersQueryOptions, type ListUsersParams } from "../api/admin-users-api";

export const PAGE_SIZE = 10;

export type RoleFilter = "all" | "admin" | "user";
export type SortDirection = "asc" | "desc";

/**
 * Server-side table state: search (debounced 300ms), role filter, sort,
 * pagination. `keepPreviousData` keeps the current rows on screen while the
 * next page loads (no flicker/jump).
 */
export function useUsersTable() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);

  const params: ListUsersParams = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortDirection,
    ...(debouncedSearch ? { searchValue: debouncedSearch } : {}),
    ...(roleFilter !== "all"
      ? { filterField: "role", filterValue: roleFilter, filterOperator: "eq" as const }
      : {}),
  };

  const query = useQuery({
    ...adminUsersQueryOptions(params),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
    setPage(0);
  }

  return {
    query,
    users: query.data?.users ?? [],
    total,
    page,
    pageCount,
    setPage,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(0);
    },
    roleFilter,
    setRoleFilter: (value: RoleFilter) => {
      setRoleFilter(value);
      setPage(0);
    },
    sortBy,
    sortDirection,
    toggleSort,
  };
}
