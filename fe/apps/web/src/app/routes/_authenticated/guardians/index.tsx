// Màn quản lý người thân trông ví (PHA 6 — cụm ĐỌC). Dữ liệu thật từ
// GET /api/guardians/wallet/:id; trạng thái kết nối chỉ CHỦ VÍ thấy (luật 5).
import { Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("guardians.manage.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("guardians.manage.description")}</p>

      {walletLoading || guardians.isLoading ? <LoadingRows /> : null}
      {walletError || guardians.isError ? <ErrorState /> : null}
      {!walletLoading && !walletError && wallet === null ? (
        <EmptyState message={t("guardians.list.noWallet")} />
      ) : null}
      {guardians.isSuccess && visible.length === 0 ? (
        <EmptyState message={t("guardians.list.empty")} />
      ) : null}

      <ul className="flex flex-col gap-3">
        {visible.map((g) => (
          <li key={g.id}>
            <Link to="/guardians/$guardianId" params={{ guardianId: g.id }} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground text-sm">
                      {t("guardians.list.itemLabel")}
                    </span>
                    <span className="font-mono text-muted-foreground text-xs">
                      {shortKey(g.onchainKey)}
                    </span>
                  </div>
                  <GuardianStatusBadge status={g.status} />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
