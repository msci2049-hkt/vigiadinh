// Màn quản lý người thân trông ví (PHA 6 — cụm ĐỌC). Dữ liệu thật từ
// GET /api/guardians/wallet/:id; trạng thái kết nối chỉ CHỦ VÍ thấy (luật 5).
import { Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { guardiansOptions } from "@/features/family/api/guardians";
import { GuardianStatusBadge } from "@/features/family/components/guardian-status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/guardians/")({
  component: GuardiansManageScreen,
});

function shortKey(key: string | null): string {
  return key ? `${key.slice(0, 4)}…${key.slice(-4)}` : "—";
}

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
        <EmptyState message={t("guardians.list.empty")} />
      ) : null}

      <ul className="flex flex-col gap-3">
        {visible.map((g, index) => (
          <li key={g.id}>
            <Link to="/guardians/$guardianId" params={{ guardianId: g.id }} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={`/assets/avatars/${["mom", "brother", "aunt", "uncle", "sister", "grandfather"][index % 6]}-104.webp`}
                      alt=""
                      className="size-14 rounded-full object-cover"
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-semibold text-foreground text-sm">
                        {t("guardians.list.itemLabel")}
                      </span>
                      <span className="font-mono text-muted-foreground text-xs">
                        {shortKey(g.onchainKey)}
                      </span>
                    </div>
                  </div>
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
