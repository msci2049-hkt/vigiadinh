// Sổ hoạt động của ví (PHA 6 — cụm ĐỌC): audit_log append-only (event on-chain
// mirror + hành động hệ thống). Chữ + chi tiết payload của MỘT dòng nằm trong
// features/family (map kind ở lib/audit-kind, render ở components/audit-entry-row)
// — màn này chỉ lo tải dữ liệu và trạng thái chờ/lỗi/rỗng.

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { auditOptions } from "@/features/family/api/audit";
import { AuditEntryRow } from "@/features/family/components/audit-entry-row";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/wallet/history")({
  component: WalletHistoryScreen,
});

function WalletHistoryScreen() {
  const { t } = useTranslation("fw");
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
            <AuditEntryRow entry={entry} />
          </li>
        ))}
      </ul>
    </ProductScreen>
  );
}
