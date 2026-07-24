// Sổ hoạt động của ví (PHA 6 — cụm ĐỌC): audit_log append-only (event on-chain
// mirror + hành động hệ thống). Ngày giờ qua formatDateTime (locale + tz người
// xem — PHA 7.1); loại sự kiện dịch qua map key i18n, loại lạ → nhãn chung.

import { formatDateTime } from "@repo/core";
import { Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("wallet.history.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("wallet.history.description")}</p>

      {walletLoading || audit.isLoading ? <LoadingRows /> : null}
      {walletError || audit.isError ? <ErrorState /> : null}
      {!walletLoading && !walletError && wallet === null ? (
        <EmptyState message={t("history.noWallet")} />
      ) : null}
      {audit.isSuccess && audit.data.length === 0 ? (
        <EmptyState message={t("history.empty")} />
      ) : null}

      <ul className="flex flex-col gap-2">
        {(audit.data ?? []).map((entry) => (
          <li key={entry.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <span className="text-foreground text-sm">{t(kindKey(entry.kind))}</span>
                <time dateTime={entry.at} className="shrink-0 text-muted-foreground text-xs">
                  {formatDateTime(entry.at, { locale: i18n.language })}
                </time>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
