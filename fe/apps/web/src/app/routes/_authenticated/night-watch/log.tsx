// Nhật ký người gác đêm (PHA 6 — cụm ĐỌC): audit_log LỌC các sự kiện an toàn
// (khôi phục + kết nối người thân + lỗ hổng dữ liệu) — khác /wallet/history
// (toàn bộ hoạt động). Cùng nguồn auditOptions → cache dùng chung.
import { formatDateTime } from "@repo/core";
import { Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icon";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { auditOptions } from "@/features/family/api/audit";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/night-watch/log")({
  component: NightWatchLogScreen,
});

// Sự kiện thuộc phạm vi "gác đêm" — map sang key i18n người thường.
const WATCH_KINDS = {
  initiate: "history.kind.recoveryStarted",
  approve: "history.kind.recoveryApproved",
  cancel: "history.kind.recoveryBlocked",
  finalize: "history.kind.recoveryDone",
  "recovery.onchain.submitted": "history.kind.actionSubmitted",
  "indexer.gap": "history.kind.gap",
} as const;

type WatchLabel = (typeof WATCH_KINDS)[keyof typeof WATCH_KINDS];

function watchKey(kind: string): WatchLabel | null {
  if (kind in WATCH_KINDS) return WATCH_KINDS[kind as keyof typeof WATCH_KINDS];
  return null;
}

function NightWatchLogScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const audit = useQuery({
    ...auditOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  const entries = (audit.data ?? []).flatMap((e) => {
    const labelKey = watchKey(e.kind);
    return labelKey ? [{ entry: e, labelKey }] : [];
  });

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("nightWatch.log.title")}
        description={t("nightWatch.log.description")}
      />

      {walletLoading || audit.isLoading ? <LoadingRows /> : null}
      {walletError || audit.isError ? <ErrorState /> : null}
      {audit.isSuccess && entries.length === 0 ? (
        <EmptyState message={t("nightWatch.logEmpty")} />
      ) : null}

      <ul className="flex flex-col gap-3">
        {entries.map(({ entry, labelKey }) => (
          <li key={entry.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary">
                  <Icon name="shieldCheck" size={20} />
                </span>
                <span className="min-w-0 flex-1 font-medium text-foreground text-sm">
                  {t(labelKey)}
                </span>
                <time dateTime={entry.at} className="shrink-0 text-muted-foreground text-xs">
                  {formatDateTime(entry.at, { locale: i18n.language })}
                </time>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </ProductScreen>
  );
}
