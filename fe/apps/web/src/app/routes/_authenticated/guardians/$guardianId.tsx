// Chi tiết MỘT người thân (PHA 6 — cụm ĐỌC): trạng thái + lần liên lạc gần
// nhất + lần xác nhận tay. BE chỉ có endpoint list → tra theo id từ cache list
// (cùng queryOptions — không gọi mạng lại nếu vừa xem danh sách).

import { formatRelativeTime } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DetailRow, PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";
import { guardiansOptions } from "@/features/family/api/guardians";
import { GuardianNameplate } from "@/features/family/components/guardian-nameplate";
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
  // Thời gian TƯƠNG ĐỐI ("2 giờ trước") — mốc tuyệt đối khó đọc nhanh; cột
  // chưa từng được ghi → nói thẳng "chưa có hoạt động", không bịa số.
  const fmt = (iso: string | null) =>
    iso ? formatRelativeTime(iso, { locale: i18n.language }) : t("guardians.detail.noActivity");

  return (
    // data-rev: xoay hash chunk sau sự cố cache độc edge 28/07 (xem ghi chú ở
    // invite-card.tsx) — URL `_guardianId-CJcYEO3X.js` đang bị cache HTML
    // fallback immutable 1 năm; đổi nội dung SỐNG SÓT qua minify là đường vá.
    <ProductScreen data-rev="2">
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
            <div className="mb-5">
              <GuardianNameplate label={guardian.label} onchainKey={guardian.onchainKey} />
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
