// Cảnh báo mất kết nối (PHA 2.2 night-watch): liệt kê NGƯỜI THÂN đang im ắng /
// mất liên lạc (status slow|offline từ ladder BE) + lần liên lạc gần nhất, dẫn
// sang /resolve. Trạng thái này CHỈ chủ ví thấy (luật 5). API không có tên hiển
// thị → tham chiếu bằng khoá rút gọn + thời gian, KHÔNG bịa tên.
import { formatDateTime } from "@repo/core";
import { Button, Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { type Guardian, guardiansOptions } from "@/features/family/api/guardians";
import { GuardianStatusBadge } from "@/features/family/components/guardian-status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/night-watch/alert")({
  component: NightWatchAlertScreen,
});

/** Nhãn tham chiếu người thân khi không có tên: khoá on-chain rút gọn hoặc thứ tự. */
function contactRef(g: Guardian, index: number): string {
  if (g.onchainKey) return `${g.onchainKey.slice(0, 6)}…${g.onchainKey.slice(-4)}`;
  return `#${index + 1}`;
}

function NightWatchAlertScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const guardians = useQuery({
    ...guardiansOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  const outOfReach = (guardians.data ?? [])
    .map((g, i) => ({ g, ref: contactRef(g, i) }))
    .filter(({ g }) => g.status === "slow" || g.status === "offline");
  const loading = walletLoading || guardians.isLoading;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("nightWatch.alert.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("nightWatch.alert.subtitle")}</p>

      {loading ? <LoadingRows /> : null}
      {walletError || guardians.isError ? <ErrorState /> : null}
      {guardians.isSuccess && outOfReach.length === 0 ? (
        <EmptyState message={t("nightWatch.alert.none")} />
      ) : null}

      <ul className="flex flex-col gap-2">
        {outOfReach.map(({ g, ref }) => (
          <li key={g.id}>
            <Card className="border-destructive/50">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-foreground text-sm">{ref}</span>
                  <GuardianStatusBadge status={g.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t("nightWatch.alert.lastSeen")}
                  </span>
                  <span className="text-foreground text-xs">
                    {g.lastSeenAt
                      ? formatDateTime(g.lastSeenAt, { locale: i18n.language })
                      : t("guardians.detail.never")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {outOfReach.length > 0 ? (
        <Button asChild variant="destructive">
          <Link to="/night-watch/resolve">{t("nightWatch.alert.resolveCta")}</Link>
        </Button>
      ) : null}
    </main>
  );
}
