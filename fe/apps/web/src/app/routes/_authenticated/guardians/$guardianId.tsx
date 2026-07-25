// Chi tiết MỘT người thân (PHA 6 — cụm ĐỌC): trạng thái + lần liên lạc gần
// nhất + lần xác nhận tay. BE chỉ có endpoint list → tra theo id từ cache list
// (cùng queryOptions — không gọi mạng lại nếu vừa xem danh sách).

import { formatDateTime } from "@repo/core";
import { Button, Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DetailRow, PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
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
    <ProductScreen>
      <ScreenHeader
        title={t("guardians.detail.title")}
        description={t("guardians.detail.description")}
      />

      {walletLoading || guardians.isLoading ? <LoadingRows /> : null}
      {walletError || guardians.isError ? <ErrorState /> : null}
      {guardians.isSuccess && guardian === null ? (
        <EmptyState message={t("guardians.detail.notFound")} />
      ) : null}

      {guardian ? (
        <Card className="bg-paper-2">
          <CardContent className="p-5">
            <div className="mb-5 flex justify-center">
              <img
                src="/assets/avatars/mom-160.webp"
                alt=""
                className="size-28 rounded-full border-[3px] border-card object-cover shadow-sm"
              />
            </div>
            <DetailRow label={t("guardians.detail.statusLabel")}>
              <GuardianStatusBadge status={guardian.status} />
            </DetailRow>
            <DetailRow label={t("guardians.detail.lastSeen")}>
              <span className="text-foreground text-sm">{fmt(guardian.lastSeenAt)}</span>
            </DetailRow>
            <DetailRow label={t("guardians.detail.lastConfirm")}>
              <span className="text-foreground text-sm">{fmt(guardian.lastManualConfirmAt)}</span>
            </DetailRow>
            {guardian.onchainKey ? (
              <DetailRow label={t("guardians.detail.keyLabel")}>
                <span className="text-right font-mono text-foreground text-xs">
                  {`${guardian.onchainKey.slice(0, 6)}…${guardian.onchainKey.slice(-6)}`}
                </span>
              </DetailRow>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <PrimaryZone>
        <Button asChild variant="secondary">
          <Link to="/guardians">{t("guardians.detail.backCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
