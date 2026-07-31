// Lô R6 — CẢNH BÁO "có người đang xin chuyển ví của bạn sang máy khác", đặt trên
// hub ví và trung tâm an toàn.
//
// Vì sao phải có: `chain-truth` đã chở `request` (có yêu cầu nào đang mở không)
// và hub ví đã gọi nó mỗi 20 giây từ trước lô này — nhưng chỉ dùng `registered`
// và `cooldown` rồi VỨT `request` đi. Chủ ví ở màn họ mở nhiều nhất không thấy
// một chữ nào về việc ví sắp đổi chủ sau 24 giờ. Kẻ tấn công không cần indexer
// chết, chỉ cần chủ ví không mở tab "An toàn" trong đúng một ngày.
//
// NGUỒN LÀ CHAIN, không phải mirror — cùng lý do với `/block` (indexer chết thì
// mirror câm, mà lúc đó mới đúng là lúc cần cảnh báo nhất).
import { timelockView } from "@repo/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Button } from "@/components/family/ui";
import { type ChainTruth, openOnchainRequest } from "@/features/family/api/recovery";

export function RecoveryAlert({
  chain,
  isError,
  isLoading = false,
}: {
  chain: ChainTruth | undefined;
  isError: boolean;
  isLoading?: boolean;
}) {
  const { t, i18n } = useTranslation("fw");

  // Chain không đọc được = KHÔNG kết luận "không có gì đang mở". Im lặng ở đây
  // chính là fail-open mà cả đường chain-truth sinh ra để tránh
  // (chain-truth/handler.ts: thà 502 còn hơn trả "an toàn" sai).
  if (isError) {
    return (
      <div data-testid="recovery-alert-unknown">
        <ErrorBanner type="warn" title={t("recoveryAlert.unknownTitle")}>
          {t("recoveryAlert.unknownBody")}
        </ErrorBanner>
      </div>
    );
  }
  if (isLoading) return null;

  const open = openOnchainRequest(chain);
  if (!open) return null;

  // Mốc hết cửa sổ = bây giờ + số giây chain còn báo (khuôn block/index.tsx).
  const veto = timelockView(
    new Date(Date.now() + open.timelockRemainingSecs * 1000).toISOString(),
    {
      locale: i18n.language,
    },
  );

  return (
    <section
      className="flex flex-col gap-3 rounded-card border border-destructive bg-paper-2 p-4"
      data-testid="recovery-alert"
      role="alert"
    >
      <h2 className="font-semibold text-destructive text-sm">{t("recoveryAlert.title")}</h2>
      <p className="text-foreground text-sm">
        {veto.expired
          ? t("recoveryAlert.bodyExpired")
          : t("recoveryAlert.body", { remaining: veto.countdown, when: veto.absolute })}
      </p>
      <Button asChild variant="danger">
        <Link to="/block">{t("recoveryAlert.cta")}</Link>
      </Button>
    </section>
  );
}
