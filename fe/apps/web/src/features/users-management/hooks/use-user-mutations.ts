import { sessionQueryKey } from "@repo/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as api from "../api/admin-users-api";
import { adminUsersKeys } from "../api/admin-users-api";

/**
 * All row mutations are PESSIMISTIC: server first, then invalidate + toast.
 * Admin actions are too sensitive for optimistic UI — a rolled-back "banned"
 * badge that was never real is worse than a 300ms wait.
 */
export function useUserMutations() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation("admin");

  function invalidateUsers() {
    void queryClient.invalidateQueries({ queryKey: adminUsersKeys.all });
  }

  function onError(err: unknown) {
    toast.error(err instanceof Error ? err.message : t("errors.generic"));
  }

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin" | "user" }) =>
      api.setRole(userId, role),
    onSuccess: () => {
      toast.success(t("users.toasts.roleUpdated"));
      invalidateUsers();
    },
    onError,
  });

  const ban = useMutation({
    mutationFn: ({
      userId,
      reason,
      expiresIn,
    }: {
      userId: string;
      reason?: string;
      expiresIn?: number;
    }) => api.banUser(userId, reason, expiresIn),
    onSuccess: () => {
      toast.success(t("users.toasts.banned"));
      invalidateUsers();
    },
    onError,
  });

  const unban = useMutation({
    mutationFn: (userId: string) => api.unbanUser(userId),
    onSuccess: () => {
      toast.success(t("users.toasts.unbanned"));
      invalidateUsers();
    },
    onError,
  });

  const setPassword = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.setUserPassword(userId, newPassword),
    onSuccess: () => toast.success(t("users.toasts.passwordSet")),
    onError,
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.removeUser(userId),
    onSuccess: () => {
      toast.success(t("users.toasts.removed"));
      invalidateUsers();
    },
    onError,
  });

  const revokeSessions = useMutation({
    mutationFn: (userId: string) => api.revokeUserSessions(userId),
    onSuccess: () => toast.success(t("users.toasts.sessionsRevoked")),
    onError,
  });

  const impersonate = useMutation({
    mutationFn: (userId: string) => api.impersonateUser(userId),
    onSuccess: async () => {
      // The cookie now belongs to the impersonated user — reset the session
      // cache and land on the app as them. The root banner offers the way back.
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      toast.success(t("users.toasts.impersonating"));
      await navigate({ to: "/" });
    },
    onError,
  });

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      password: string;
      role: "admin" | "user";
    }) => api.createUser(input),
    onSuccess: () => {
      toast.success(t("users.toasts.created"));
      invalidateUsers();
    },
    onError,
  });

  return { setRole, ban, unban, setPassword, remove, revokeSessions, impersonate, create };
}

export type UserMutations = ReturnType<typeof useUserMutations>;
