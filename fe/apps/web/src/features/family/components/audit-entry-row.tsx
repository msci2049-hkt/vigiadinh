// Một dòng của sổ hoạt động (LÔ 5, 2026-07-30).
//
// TRƯỚC: màn lịch sử render đúng `t(kindKey)` + `entry.at` và VỨT NGUYÊN payload —
// mà payload đã nằm trong response từ đầu (handler trả nguyên `page.items`). Người
// dùng gửi 65 XLM xong mở lịch sử ra chỉ thấy một câu chung, không mã giao dịch,
// không trạng thái, không có gì đối chiếu được với mạng lưới.
//
// B3: số tiền + người nhận giờ do BE join từ `transaction_intents` gửi kèm. Dòng
// tiền ĐÃ RA gộp thẳng vào câu chính ("Đã gửi 65 XLM cho CBYKUI…35SYDI"); dòng
// đang chờ/huỷ/lỗi giữ câu theo trạng thái và chở số tiền ở dòng phụ — nói "đã
// gửi" về một lệnh chưa gửi là nói sai về tiền của người ta.
//
// Câu chính = chữ người thường. Mã kỹ thuật xuống DÒNG NHỎ MỜ, có link
// stellar.expert theo MẠNG đang cấu hình (cấm hardcode network — rule stellar).
import { formatAmount, formatDateTime } from "@repo/core";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { Card, CardContent } from "@/components/family/ui";
import type { AuditEntry } from "@/features/family/api/audit";
import { shortAddress } from "@/features/family/lib/address";
import {
  auditDetails,
  auditKindKey,
  MONEY_OUT_KEY,
  shortHash,
} from "@/features/family/lib/audit-kind";
import { explorerTxUrl } from "@/lib/stellar-explorer";

export function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const { t, i18n } = useTranslation("fw");
  const details = auditDetails(entry);
  const kindKey = auditKindKey(entry.kind, entry.payload);

  // Format ở LÁ CUỐI, locale tường minh (luật module tiền — packages/core/money).
  const money =
    details.amount === null
      ? null
      : formatAmount(details.amount, { locale: i18n.language, code: "XLM" });
  const to = details.recipient === null ? null : shortAddress(details.recipient);
  // Gộp vào câu chính CHỈ khi tiền đã thật sự ra khỏi ví và biết đi đâu.
  const sentOut = money !== null && to !== null && kindKey === MONEY_OUT_KEY;

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary">
          <Icon name="history" size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium text-foreground text-sm">
            {sentOut && money !== null && to !== null
              ? t("history.sentTo", { amount: money, recipient: to })
              : t(kindKey)}
          </span>
          {!sentOut && money !== null ? (
            <span className="font-semibold text-foreground text-sm">
              {to === null ? money : t("history.detail.amountTo", { amount: money, recipient: to })}
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
