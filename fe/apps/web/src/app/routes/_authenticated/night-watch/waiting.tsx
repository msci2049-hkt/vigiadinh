// Chờ kết nối lại (PHA 2.2): sau khi đã nhắn người thân, màn này hiện những ai
// còn đang chờ (slow|offline) với mốc gần nhất. Không poll gắt — dữ liệu tự mới
// khi vào lại màn / invalidate; khoảnh khắc họ mở app, ladder BE đổi bậc → mục
// tự hết. Trạng thái chỉ chủ ví thấy (luật 5).
import { formatDateTime } from "@repo/core";
import { Button, Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { type Guardian, guardiansOptions } from "@/features/family/api/guardians";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/night-watch/waiting")({
  component: NightWatchWaitingScreen,
});

function contactRef(g: Guardian, index: number): string {
  if (g.onchainKey) return `${g.onchainKey.slice(0, 6)}…${g.onchainKey.slice(-4)}`;
  return `#${index + 1}`;
}

function NightWatchWaitingScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const guardians = useQuery({
    ...guardiansOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  const waiting = (guardians.data ?? [])
    .map((g, i) => ({ g, ref: contactRef(g, i) }))
    .filter(({ g }) => g.status === "slow" || g.status === "offline");
  const loading = walletLoading || guardians.isLoading;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("nightWatch.waiting.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("nightWatch.waiting.description")}</p>

      {loading ? <LoadingRows /> : null}
      {walletError || guardians.isError ? <ErrorState /> : null}
      {guardians.isSuccess && waiting.length === 0 ? (
        <EmptyState message={t("nightWatch.waiting.none")} />
      ) : null}

      <ul className="flex flex-col gap-2">
        {waiting.map(({ g, ref }) => (
          <li key={g.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <span className="font-mono text-foreground text-sm">{ref}</span>
                <span className="text-muted-foreground text-xs">
                  {t("nightWatch.waiting.item", {
                    when: g.lastSeenAt
                      ? formatDateTime(g.lastSeenAt, { locale: i18n.language })
                      : t("guardians.detail.never"),
                  })}
                </span>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {waiting.length > 0 ? (
        <p className="text-muted-foreground text-sm">{t("nightWatch.waiting.hint")}</p>
      ) : null}

      <Button asChild variant="ghost">
        <Link to="/night-watch">{t("nightWatch.waiting.backCta")}</Link>
      </Button>
    </main>
  );
}
