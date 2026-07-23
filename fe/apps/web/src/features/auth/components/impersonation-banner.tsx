import { sessionQueryKey } from "@repo/auth";
import { Button } from "@repo/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";

/**
 * Fixed warning shown at app root while an admin is impersonating another user
 * (session.impersonatedBy set by the BE admin plugin). ALWAYS gives a way out —
 * without it the admin is stuck as the user until the impersonation session
 * expires. Renders nothing otherwise.
 */
export function ImpersonationBanner() {
  const { data } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("common");
  const [stopping, setStopping] = useState(false);

  if (!data?.session.impersonatedBy) return null;

  async function stop() {
    setStopping(true);
    const { error } = await authClient.admin.stopImpersonating();
    setStopping(false);
    if (error) {
      toast.error(error.message ?? "stopImpersonating failed");
      return;
    }
    queryClient.removeQueries({ queryKey: sessionQueryKey });
    await navigate({ to: "/admin/users" });
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-amber-950 text-sm">
      <span>{t("impersonation.banner", { name: data.user.name ?? data.user.email })}</span>
      <Button size="xs" variant="outline" disabled={stopping} onClick={stop}>
        {t("impersonation.stop")}
      </Button>
    </div>
  );
}
