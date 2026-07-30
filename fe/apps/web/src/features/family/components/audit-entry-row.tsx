// Một dòng của sổ hoạt động (LÔ 5, 2026-07-30).
//
// TRƯỚC: màn lịch sử render đúng `t(kindKey)` + `entry.at` và VỨT NGUYÊN payload —
// mà payload đã nằm trong response từ đầu (handler trả nguyên `page.items`). Người
// dùng gửi 65 XLM xong mở lịch sử ra chỉ thấy một câu chung, không mã giao dịch,
// không trạng thái, không có gì đối chiếu được với mạng lưới.
//
// Câu chính = chữ người thường. Mã kỹ thuật xuống DÒNG NHỎ MỜ, có link
// stellar.expert theo MẠNG đang cấu hình (cấm hardcode network — rule stellar).
import { formatAmount, formatDateTime } from "@repo/core";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { Card, CardContent } from "@/components/family/ui";
import type { AuditEntry } from "@/features/family/api/audit";
import { auditDetails, auditKindKey, shortHash } from "@/features/family/lib/audit-kind";
import { explorerTxUrl } from "@/lib/stellar-explorer";

export function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const { t, i18n } = useTranslation("fw");
  const details = auditDetails(entry.payload);

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary">
          <Icon name="history" size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium text-foreground text-sm">
            {t(auditKindKey(entry.kind, entry.payload))}
          </span>
          {details.amount !== null ? (
            <span className="font-semibold text-foreground text-sm">
              {formatAmount(details.amount, { locale: i18n.language, code: "XLM" })}
            </span>
          ) : null}
          {details.statusKey !== null ? (
            <span className="text-muted-foreground text-xs">{t(details.statusKey)}</span>
          ) : null}
          {details.txHash !== null ? (
            <a
              href={explorerTxUrl(details.txHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center break-all font-mono text-muted-foreground text-xs underline"
            >
              {t("history.detail.txLabel", { hash: shortHash(details.txHash) })}
            </a>
          ) : null}
        </div>
        <time dateTime={entry.at} className="shrink-0 text-muted-foreground text-xs">
          {formatDateTime(entry.at, { locale: i18n.language })}
        </time>
      </CardContent>
    </Card>
  );
}
