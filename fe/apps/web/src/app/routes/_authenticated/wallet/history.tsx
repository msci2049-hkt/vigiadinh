// Sổ hoạt động của ví (PHA 6 — cụm ĐỌC): audit_log append-only (event on-chain
// mirror + hành động hệ thống). Ngày giờ qua formatDateTime (locale + tz người
// xem — PHA 7.1); loại sự kiện dịch qua map key i18n, loại lạ → nhãn chung.

import { formatDateTime } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icon";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Card, CardContent } from "@/components/family/ui";
import { auditOptions } from "@/features/family/api/audit";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/wallet/history")({
  component: WalletHistoryScreen,
});

// kind audit_log → key i18n (chuỗi người thường). Ngoài map → generic.
const KIND_KEYS = {
  initiate: "history.kind.recoveryStarted",
  approve: "history.kind.recoveryApproved",
  cancel: "history.kind.recoveryBlocked",
  finalize: "history.kind.recoveryDone",
  register: "history.kind.walletRegistered",
  "recovery.onchain.submitted": "history.kind.actionSubmitted",
  "intent.expired": "history.kind.requestExpired",
  "indexer.gap": "history.kind.gap",
} as const;

function kindKey(kind: string): (typeof KIND_KEYS)[keyof typeof KIND_KEYS] | "history.kind.other" {
  return kind in KIND_KEYS ? KIND_KEYS[kind as keyof typeof KIND_KEYS] : "history.kind.other";
}

function WalletHistoryScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const audit = useQuery({
    ...auditOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("wallet.history.title")}
        description={t("wallet.history.description")}
      />

      {walletLoading || audit.isLoading ? <LoadingRows /> : null}
      {walletError || audit.isError ? <ErrorState /> : null}
      {!walletLoading && !walletError && wallet === null ? (
        <EmptyState message={t("history.noWallet")} />
      ) : null}
      {audit.isSuccess && audit.data.length === 0 ? (
        <EmptyState message={t("history.empty")} />
      ) : null}

      <ul className="relative flex flex-col gap-3 before:absolute before:top-6 before:bottom-6 before:left-5 before:w-px before:bg-border">
        {(audit.data ?? []).map((entry) => (
          <li key={entry.id} className="relative">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary">
                  <Icon name="history" size={20} />
                </span>
                <span className="min-w-0 flex-1 font-medium text-foreground text-sm">
                  {t(kindKey(entry.kind))}
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
