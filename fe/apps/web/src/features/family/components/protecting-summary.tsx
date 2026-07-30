// Khối "Bạn đang bảo hộ cho" trên màn Người thân (lô 30/07 — chiều NGƯỢC).
// Trước đây /guardians chỉ có chiều "ai bảo hộ ví TÔI", còn màn chi tiết
// /protecting (C7) mồ côi — không tab, không link, người bảo hộ không biết
// mình đang gánh gì. Khối này là bản TÓM TẮT: tên + email ĐÃ CHE + ngày nhận
// lời + trạng thái; ví có việc chờ (phiếu chi / khôi phục) nổi lên đầu và cả
// thẻ dẫn vào /protecting — nơi duyệt thật. KHÔNG số dư, KHÔNG lịch sử,
// KHÔNG địa chỉ ví của chủ (khoá bằng key-list test protectingItemView ở BE).
import { formatDate } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent } from "@/components/family/ui";
import { guardianInboxOptions } from "../api/guardian-inbox";
import { pendingApprovalsOptions } from "../api/pending-approvals";
import { protectingOptions } from "../api/protecting";
import { GuardianStatusBadge } from "./guardian-status-badge";
import { EmptyState, ErrorState, LoadingRows } from "./screen-state";

export function ProtectingSummary() {
  const { t, i18n } = useTranslation("fw");
  const protecting = useQuery(protectingOptions);
  const inbox = useQuery(guardianInboxOptions);
  const approvals = useQuery(pendingApprovalsOptions);

  // Ví có việc đang chờ chính user này: yêu cầu khôi phục mở HOẶC phiếu chi
  // chờ duyệt — nổi lên đầu, cùng luật sort với màn /protecting.
  const workWalletIds = new Set<string>([
    ...(inbox.data ?? []).map((item) => item.wallet.id),
    ...(approvals.data ?? []).map((a) => a.wallet_id),
  ]);
  const items = [...(protecting.data ?? [])].sort(
    (a, b) => Number(workWalletIds.has(b.wallet_id)) - Number(workWalletIds.has(a.wallet_id)),
  );

  return (
    <section className="flex flex-col gap-3" aria-label={t("protecting.summary.title")}>
      <h2 className="font-semibold text-foreground text-sm">{t("protecting.summary.title")}</h2>

      {protecting.isLoading ? <LoadingRows /> : null}
      {protecting.isError ? <ErrorState /> : null}
      {protecting.isSuccess && items.length === 0 ? (
        // Câu rỗng RIÊNG của chiều ngược — không dùng chung "Chưa có người thân nào".
        <EmptyState message={t("protecting.summary.empty")} />
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const hasWork = workWalletIds.has(item.wallet_id);
          const name = item.owner_name?.trim() ? item.owner_name : t("protecting.item.unnamed");
          return (
            <li key={item.id}>
              <Link to="/protecting" className="block">
                <Card
                  className={
                    hasWork
                      ? "border-primary bg-accent transition-colors hover:bg-accent/80"
                      : "bg-paper-2 transition-colors hover:bg-accent"
                  }
                >
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-semibold text-foreground text-sm">
                        {t("protecting.item.title", { name })}
                      </span>
                      <GuardianStatusBadge status={item.status} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {item.owner_email_masked}
                      {" · "}
                      {t("protecting.item.since", {
                        date: formatDate(item.protecting_since, { locale: i18n.language }),
                      })}
                    </p>
                    {hasWork ? (
                      <p className="font-semibold text-destructive text-xs">
                        {t("protecting.summary.pendingWork")}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {items.length > 0 ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/protecting">{t("protecting.summary.openCta")}</Link>
        </Button>
      ) : null}
    </section>
  );
}
