// Raw admin API calls (no React) — thin wrappers over authClient.admin.*.
// Every admin call is re-authorized by the BE (Better Auth admin plugin);
// the FE only decides what to render.
import { queryOptions } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  emailVerified: boolean;
  createdAt: Date | string;
  image?: string | null;
}

export interface AdminUserSession {
  id: string;
  token: string;
  createdAt: Date | string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  impersonatedBy?: string | null;
}

export interface ListUsersParams {
  limit: number;
  offset: number;
  searchValue?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filterField?: string;
  filterValue?: string | number | boolean;
  filterOperator?: "eq" | "ne" | "contains";
}

export const adminUsersKeys = {
  all: ["admin", "users"] as const,
  list: (params: ListUsersParams) => [...adminUsersKeys.all, "list", params] as const,
  sessions: (userId: string) => [...adminUsersKeys.all, "sessions", userId] as const,
};

/** Unwrap Better Auth's `{ data, error }` into throw-on-error (TanStack-friendly). */
function unwrap<T>(result: {
  data: T | null;
  error: { message?: string | undefined; code?: string | undefined } | null;
}): T {
  if (result.error) throw new Error(result.error.message ?? "Admin API error");
  if (result.data == null) throw new Error("Admin API returned no data");
  return result.data;
}

export async function listUsers(params: ListUsersParams) {
  const { searchValue, ...rest } = params;
  const result = await authClient.admin.listUsers({
    query: {
      ...rest,
      ...(searchValue
        ? { searchValue, searchField: "email" as const, searchOperator: "contains" as const }
        : {}),
    },
  });
  return unwrap(result) as { users: AdminUser[]; total: number };
}

export function adminUsersQueryOptions(params: ListUsersParams) {
  return queryOptions({
    queryKey: adminUsersKeys.list(params),
    queryFn: () => listUsers(params),
  });
}

export async function listUserSessions(userId: string): Promise<AdminUserSession[]> {
  const result = await authClient.admin.listUserSessions({ userId });
  return (unwrap(result) as { sessions: AdminUserSession[] }).sessions ?? [];
}

export const createUser = (input: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
}) => authClient.admin.createUser(input).then(unwrap);

export const setRole = (userId: string, role: "admin" | "user") =>
  authClient.admin.setRole({ userId, role }).then(unwrap);

export const banUser = (userId: string, banReason?: string, banExpiresIn?: number) =>
  authClient.admin
    .banUser({
      userId,
      ...(banReason ? { banReason } : {}),
      ...(banExpiresIn ? { banExpiresIn } : {}),
    })
    .then(unwrap);

export const unbanUser = (userId: string) => authClient.admin.unbanUser({ userId }).then(unwrap);

export const setUserPassword = (userId: string, newPassword: string) =>
  authClient.admin.setUserPassword({ userId, newPassword }).then(unwrap);

export const removeUser = (userId: string) => authClient.admin.removeUser({ userId }).then(unwrap);

export const revokeUserSessions = (userId: string) =>
  authClient.admin.revokeUserSessions({ userId }).then(unwrap);

export const revokeUserSession = (sessionToken: string) =>
  authClient.admin.revokeUserSession({ sessionToken }).then(unwrap);

export const impersonateUser = (userId: string) =>
  authClient.admin.impersonateUser({ userId }).then(unwrap);
