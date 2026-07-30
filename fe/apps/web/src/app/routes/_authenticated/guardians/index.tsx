// Màn Người thân (PHA 6 — cụm ĐỌC, dựng lại lô 30/07 thành HAI KHỐI):
//   1. "Người bảo hộ ví của bạn (x/3)" — GET /api/guardians/wallet/:id,
//      trạng thái kết nối chỉ CHỦ VÍ thấy (luật 5). Số (x/3) đọc từ
//      recoverability của BE (nguồn ngưỡng duy nhất), KHÔNG hardcode.
//   2. "Bạn đang bảo hộ cho" — chiều NGƯỢC (ProtectingSummary). Trước lô này
//      màn chỉ có chiều 1: người vừa nhận lời bảo hộ mở tab Người thân vẫn
//      thấy "Chưa có người thân nào" — sai sự thật và mất luôn đường vào việc
//      duyệt của người bảo hộ.
// Hai khối rỗng có HAI câu riêng; người chỉ-là-guardian (chưa có ví) vẫn thấy
// khối 2 đầy đủ.

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Card, CardContent } from "@/components/family/ui";
import { guardiansOptions } from "@/features/family/api/guardians";
import { invitesOptions } from "@/features/family/api/invites";
import { GuardianNameplate } from "@/features/family/components/guardian-nameplate";
import { GuardianStatusBadge } from "@/features/family/components/guardian-status-badge";
import { ProtectingSummary } from "@/features/family/components/protecting-summary";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/guardians/")({
  component: GuardiansManageScreen,
});

function GuardiansManageScreen() {
  const { t } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const guardians = useQuery({
    ...guardiansOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });
  // recoverability {available, required} — cùng nguồn với setup/review, cho
  // tiêu đề "(x/3)" nói số thật thay vì đếm client tự suy.
  const invites = useQuery({
    ...invitesOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  const visible = guardians.data?.filter((g) => g.status !== "removed") ?? [];
  const recoverability = invites.data?.recoverability;
  const mineTitle =
    recoverability?.required != null
      ? t("guardians.manage.mineTitle", {
          available: recoverability.available,
          required: recoverability.required,
        })
      : t("guardians.manage.mineTitleNoCount");

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("guardians.manage.title")}
        description={t("guardians.manage.description")}
      />

      <section className="flex flex-col gap-3" aria-label={mineTitle}>
        <h2 className="font-semibold text-foreground text-sm">{mineTitle}</h2>

        {walletLoading || (wallet !== null && guardians.isLoading) ? <LoadingRows /> : null}
        {walletError || guardians.isError ? <ErrorState /> : null}
        {!walletLoading && !walletError && wallet === null ? (
          <EmptyState message={t("guardians.list.noWallet")} />
        ) : null}
        {guardians.isSuccess && visible.length === 0 ? (
          <EmptyState
            message={t("guardians.list.empty")}
            cta={{ label: t("guardians.list.emptyCta"), to: "/setup/choose-guardians" }}
          />
        ) : null}

        <ul className="flex flex-col gap-3">
          {visible.map((g) => (
            <li key={g.id}>
              <Link to="/guardians/$guardianId" params={{ guardianId: g.id }} className="block">
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <GuardianNameplate label={g.label} onchainKey={g.onchainKey} />
                    <GuardianStatusBadge status={g.status} />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ProtectingSummary />
    </ProductScreen>
  );
}
