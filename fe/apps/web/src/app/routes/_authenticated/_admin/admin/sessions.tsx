import { formatDateTime } from "@repo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/family/ui";
import { authClient, useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/_admin/admin/sessions")({
  component: AdminSessionsPage,
});

const sessionsKeys = { all: ["admin", "my-sessions"] as const };

/** The signed-in admin's own devices/sessions, with per-session revoke. */
function AdminSessionsPage() {
  const { t, i18n } = useTranslation("admin");
  const queryClient = useQueryClient();
  const { data: current } = useSession();

  const sessions = useQuery({
    queryKey: sessionsKeys.all,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message ?? "listSessions failed");
      return data ?? [];
    },
  });

  // PESSIMISTIC: revoke on the BE first, then refetch the list.
  const revoke = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw new Error(error.message ?? "revokeSession failed");
    },
    onSuccess: () => {
      toast.success(t("sessions.revoked"));
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-semibold text-2xl">{t("sessions.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("sessions.description")}</p>
      </div>
      {sessions.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-3">
          {(sessions.data ?? []).map((s) => {
            const isCurrent = s.token === current?.session.token;
            return (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="truncate">{s.userAgent ?? t("sessions.unknownDevice")}</span>
                    {isCurrent ? <Badge variant="secondary">{t("sessions.current")}</Badge> : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4 text-muted-foreground text-xs">
                  <span>
                    IP: {s.ipAddress ?? "—"} ·{" "}
                    {t("sessions.expires", {
                      value: formatDateTime(s.expiresAt, { locale: i18n.language }),
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isCurrent || revoke.isPending}
                    onClick={() => revoke.mutate(s.token)}
                  >
                    {t("sessions.revoke")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
