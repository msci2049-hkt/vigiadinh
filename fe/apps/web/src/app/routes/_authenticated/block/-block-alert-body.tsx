// Thân màn CẢNH BÁO chặn khôi phục — tách khỏi `index.tsx` ở lô R7 để bốn
// trạng thái của nó test được bằng DOM thật (khuôn `-send-screens.tsx`).
//
// Bốn trạng thái, BỐN câu khác nhau, không bao giờ dùng chung chữ:
//   đang tải          → chỉ vòng xoay, KHÔNG kết luận gì
//   chain không đọc được → "chưa kiểm tra được" + nút thử lại (🔴 CẤM nói an toàn)
//   chain nói không có   → "yêu cầu đã đóng hoặc hết hạn, ví của bạn an toàn"
//   chain nói có         → phiếu/ngưỡng + mã khoá mới + đếm ngược + nút Chặn
import { timelockView } from "@repo/core";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { PrimaryZone } from "@/components/family/screen";
import { TimelockCountdown } from "@/components/family/timelock-countdown";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import type { ChainTruth, RecoveryRequest } from "@/features/family/api/recovery";
import { openOnchainRequest } from "@/features/family/api/recovery";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";

/** Đúng những gì màn này cần biết về query chain — dựng được trong test. */
export type ChainState = {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  data: ChainTruth | undefined;
  refetch: () => void;
};

export function BlockAlertBody({
  walletLoading,
  walletError,
  chain,
  mirrorOpen,
}: {
  walletLoading: boolean;
  walletError: boolean;
  chain: ChainState;
  /** Dòng mirror đang mở (nếu có) — CHỈ để lấy mã khoá mới hiển thị. */
  mirrorOpen: RecoveryRequest | undefined;
}) {
  const { t, i18n } = useTranslation("fw");
  const open = openOnchainRequest(chain.data);
  const loading = walletLoading || chain.isLoading;

  // R7 (A3b) — banner "đang cập nhật" CHỈ khi chain chưa chốt.
  //
  // Sự cố 31/07: chain đã nói rõ "không có yêu cầu nào", mirror còn dòng ma, nên
  // màn hình hiện ĐỒNG THỜI câu kết luận và một banner có vòng xoay "vài chi
  // tiết còn đang cập nhật". Chủ ví đọc vòng xoay đó thành "app chưa xong, đừng
  // tin câu kia" — banner phụ phá chính câu trả lời đúng.
  //
  // Nhưng chỉ bỏ khi chain THÀNH CÔNG. Chain lỗi hoặc đang tải mà mirror nói có
  // → banner phải còn: lúc đó ta thật sự chưa biết, và im lặng về chỗ chưa biết
  // là kiểu nói dối nguy hiểm nhất ở màn này.
  const outOfSync = !loading && !chain.isSuccess && Boolean(open) !== Boolean(mirrorOpen);

  // Đếm ngược tính từ chain: mốc hết cửa sổ = bây giờ + số giây chain còn báo.
  const veto = open
    ? timelockView(new Date(Date.now() + open.timelockRemainingSecs * 1000).toISOString(), {
        locale: i18n.language,
      })
    : null;

  return (
    <>
      {loading ? <LoadingRows /> : null}

      {/* Chain không đọc được = KHÔNG kết luận "không có gì đang mở". Nói thẳng
          là đang mù, kèm lối thử lại — im lặng ở đây là nguy hiểm nhất. */}
      {chain.isError ? (
        <div data-testid="chain-unreachable">
          <ErrorBanner type="error" title={t("block.alert.chainDownTitle")}>
            {t("block.alert.chainDownBody")}
          </ErrorBanner>
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            loading={chain.isFetching}
            onClick={() => chain.refetch()}
          >
            {t("block.alert.retryCta")}
          </Button>
        </div>
      ) : null}
      {walletError ? <ErrorState /> : null}

      {outOfSync ? (
        <div data-testid="mirror-out-of-sync">
          <ErrorBanner type="pending" title={t("block.alert.syncing")} />
        </div>
      ) : null}

      {/* R7 (A3) — người dùng vừa bấm một nút ĐỎ ở màn trước để tới đây. Câu cũ
          ("hiện không có yêu cầu khôi phục nào để chặn") đọc như app quên mất
          chuyện vừa xảy ra. Nói thẳng chuyện đã xảy ra rồi mới trấn an. */}
      {!loading && !walletError && !chain.isError && !open ? (
        <div className="flex flex-col gap-3" data-testid="block-nothing-open">
          <EmptyState message={t("block.alert.requestClosed")} />
          <Button asChild variant="outline">
            <Link to="/night-watch">{t("block.alert.backCta")}</Link>
          </Button>
        </div>
      ) : null}

      {open ? (
        <Card className="border-destructive bg-paper-2" data-testid="block-open-request">
          <CardHeader>
            <CardTitle className="text-lg">{t("block.alert.requestTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-foreground text-sm">
              {t("block.alert.requestBody", {
                approvals: open.approvals.length,
                threshold: chain.data?.config?.threshold ?? 0,
              })}
            </p>
            {mirrorOpen?.newOwner ? (
              <p className="break-all font-mono text-muted-foreground text-xs">
                {t("block.alert.fingerprintLabel", { fingerprint: mirrorOpen.newOwner })}
              </p>
            ) : null}
            {veto && !veto.expired ? (
              <TimelockCountdown countdown={veto.countdown} absolute={veto.absolute} />
            ) : null}
            <PrimaryZone>
              <Button asChild variant="danger">
                <Link to="/block/confirm">{t("block.alert.cta")}</Link>
              </Button>
            </PrimaryZone>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
