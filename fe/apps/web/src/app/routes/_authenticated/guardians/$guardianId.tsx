// Chi tiết MỘT người thân (PHA 6 — cụm ĐỌC): trạng thái + lần liên lạc gần
// nhất + lần xác nhận tay. BE chỉ có endpoint list → tra theo id từ cache list
// (cùng queryOptions — không gọi mạng lại nếu vừa xem danh sách).

import { formatDateTime } from "@repo/core";
import { Button, Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { guardiansOptions } from "@/features/family/api/guardians";
import { GuardianStatusBadge } from "@/features/family/components/guardian-status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/guardians/$guardianId")({
  component: GuardiansDetailScreen,
});

function GuardiansDetailScreen() {
  const { t, i18n } = useTranslation("fw");
  const { guardianId } = Route.useParams();
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const guardians = useQuery({
    ...guardiansOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  const guardian = guardians.data?.find((g) => g.id === guardianId) ?? null;
  const fmt = (iso: string | null) =>
    iso ? formatDateTime(iso, { locale: i18n.language }) : t("guardians.detail.never");

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("guardians.detail.title")}</h1>

      {walletLoading || guardians.isLoading ? <LoadingRows /> : null}
      {walletError || guardians.isError ? <ErrorState /> : null}
      {guardians.isSuccess && guardian === null ? (
        <EmptyState message={t("guardians.detail.notFound")} />
      ) : null}

      {guardian ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("guardians.detail.statusLabel")}
              </span>
              <GuardianStatusBadge status={guardian.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("guardians.detail.lastSeen")}
              </span>
              <span className="text-foreground text-sm">{fmt(guardian.lastSeenAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("guardians.detail.lastConfirm")}
              </span>
              <span className="text-foreground text-sm">{fmt(guardian.lastManualConfirmAt)}</span>
            </div>
            {guardian.onchainKey ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm">
                  {t("guardians.detail.keyLabel")}
                </span>
                <span className="break-all text-right font-mono text-foreground text-xs">
                  {guardian.onchainKey}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Button asChild variant="outline">
        <Link to="/guardians">{t("guardians.detail.backCta")}</Link>
      </Button>
    </main>
  );
}
