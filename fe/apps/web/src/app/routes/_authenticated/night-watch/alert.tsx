// Cảnh báo mất kết nối (PHA 2.2 night-watch): liệt kê NGƯỜI THÂN đang im ắng /
// mất liên lạc (status slow|offline từ ladder BE) + lần liên lạc gần nhất, dẫn
// sang /resolve. Trạng thái này CHỈ chủ ví thấy (luật 5). API không có tên hiển
// thị → tham chiếu bằng khoá rút gọn + thời gian, KHÔNG bịa tên.
import { formatDateTime } from "@repo/core";
import { Button, Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
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
    <ProductScreen>
      <ScreenHeader
        title={t("nightWatch.alert.title")}
        description={t("nightWatch.alert.subtitle")}
      />

      {loading ? <LoadingRows /> : null}
      {walletError || guardians.isError ? <ErrorState /> : null}
      {guardians.isSuccess && outOfReach.length === 0 ? (
        <EmptyState message={t("nightWatch.alert.none")} />
      ) : null}

      <ul className="flex flex-col gap-2">
        {outOfReach.map(({ g, ref }, index) => (
          <li key={g.id}>
            <Card className="border-border bg-paper-2">
              <CardContent className="flex gap-3 p-4">
                <img
                  src={`/assets/avatars/${index % 2 === 0 ? "aunt" : "uncle"}-104.webp`}
                  alt=""
                  className="size-14 shrink-0 rounded-full object-cover grayscale"
                />
                <div className="min-w-0 flex-1 space-y-2">
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
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {outOfReach.length > 0 ? (
        <PrimaryZone>
          <Button asChild variant="danger">
            <Link to="/night-watch/resolve">
              <Icon name="refresh" />
              {t("nightWatch.alert.resolveCta")}
            </Link>
          </Button>
        </PrimaryZone>
      ) : null}
    </ProductScreen>
  );
}
