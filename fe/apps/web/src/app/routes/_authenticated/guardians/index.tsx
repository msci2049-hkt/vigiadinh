// Màn quản lý người thân trông ví (PHA 6 — cụm ĐỌC). Dữ liệu thật từ
// GET /api/guardians/wallet/:id; trạng thái kết nối chỉ CHỦ VÍ thấy (luật 5).

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Card, CardContent } from "@/components/family/ui";
import { guardiansOptions } from "@/features/family/api/guardians";
import { GuardianNameplate } from "@/features/family/components/guardian-nameplate";
import { GuardianStatusBadge } from "@/features/family/components/guardian-status-badge";
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

  const visible = guardians.data?.filter((g) => g.status !== "removed") ?? [];

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("guardians.manage.title")}
        description={t("guardians.manage.description")}
      />

      {walletLoading || guardians.isLoading ? <LoadingRows /> : null}
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
    </ProductScreen>
  );
}
