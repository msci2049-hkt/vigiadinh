// Lô R7 nhóm B — thẻ "có người đang khôi phục ví này" đọc từ MIRROR, có CHAIN gác.
//
// Bệnh đã sửa: mirror có thể giữ một dòng đã chết trên chain (sự cố 31/07 —
// dòng mở 30/07 nằm mãi ở `pending` vì không đường ghi nào set `'expired'`).
// Thẻ này hiện nút đỏ "Không phải tôi — chặn lại" vô điều kiện; bấm vào thì
// `/block` — vốn đọc chain — trả lời "không có yêu cầu nào để chặn". Hai màn
// cãi nhau, chủ ví không biết tin ai.
//
// LUẬT: CHAIN THẮNG, LUÔN LUÔN.
//   · chain đã chốt & nói KHÔNG  → KHÔNG nút chặn, nói thẳng "yêu cầu đã đóng" (B2)
//   · chain chưa chốt (lỗi/đang đọc) → VẪN cho nút, kèm "đang kiểm tra lại".
//     Không khẳng định gì cả: chưa đọc được chain mà bảo người ta yên tâm là
//     đúng kiểu fail-open cả cụm này sinh ra để tránh (B3)
//   · chain nói CÓ mà mirror chưa có → `<RecoveryAlert>` (đọc thẳng chain) vẫn
//     hiện nút chặn; đường đó không đi qua thẻ này (B4)
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LiveCountdown } from "@/components/family/live-countdown";
import { PrimaryZone } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import type { RecoveryRequest } from "@/features/family/api/recovery";

export function MirrorRequestCard({
  request,
  chainOpen,
  chainSettled,
}: {
  request: RecoveryRequest;
  /** Chain có yêu cầu đang mở không (chỉ có nghĩa khi `chainSettled`). */
  chainOpen: boolean;
  /** Chain đã trả lời DỨT KHOÁT chưa (query success). */
  chainSettled: boolean;
}) {
  const { t } = useTranslation("fw");
  const chainSaysClosed = chainSettled && !chainOpen;

  return (
    <Card
      className={chainSaysClosed ? "bg-paper-2" : "border-destructive bg-paper-2"}
      data-testid={chainSaysClosed ? "mirror-request-closed" : "mirror-request-open"}
    >
      <CardHeader>
        <CardTitle className={chainSaysClosed ? "text-lg" : "text-destructive text-lg"}>
          {chainSaysClosed
            ? t("nightWatch.openRecovery.closedTitle")
            : t("nightWatch.openRecovery.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-foreground text-sm">
          {chainSaysClosed
            ? t("nightWatch.openRecovery.closedBody")
            : t("nightWatch.openRecovery.body", {
                approvals: request.approvals,
                threshold: request.threshold ?? 0,
              })}
        </p>
        {!chainSaysClosed && request.vetoUntil ? (
          <LiveCountdown deadline={request.vetoUntil} label={t("countdown.blockWindowLabel")} />
        ) : null}
        {chainSettled ? null : (
          <p className="text-muted-foreground text-xs" data-testid="mirror-rechecking">
            {t("nightWatch.openRecovery.rechecking")}
          </p>
        )}
        {chainSaysClosed ? null : (
          <PrimaryZone>
            <Button asChild variant="danger">
              <Link to="/block">{t("nightWatch.openRecovery.cta")}</Link>
            </Button>
          </PrimaryZone>
        )}
      </CardContent>
    </Card>
  );
}
