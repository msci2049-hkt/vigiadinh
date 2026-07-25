// Màn CẢNH BÁO chặn khôi phục (PHA 6 — cụm GHI, luồng veto đi đầu).
// Luật veto: MỘT hành động duy nhất, không nút phụ. Hiện fingerprint KHOÁ MỚI
// mà yêu cầu khôi phục đề cử — người dùng thấy ĐÚNG thứ sắp bị chặn, cùng lớp
// chống-ký-mù với màn ký (ghi chú audit P0 trong BUILD-LOG).
//
// NGUỒN SỰ THẬT Ở MÀN NÀY LÀ CHAIN, không phải mirror (sửa 2026-07-25):
// chủ ví chỉ chặn được nếu BIẾT có khôi phục đang mở. Nếu "biết" phụ thuộc
// mirror, thì indexer chết trong cửa sổ timelock = không ai báo = không ai chặn
// = khôi phục hoàn tất. Kẻ tấn công không cần phá chữ ký nào, chỉ cần indexer
// nghỉ đúng một ngày. Mirror vẫn dùng để lấy fingerprint khoá mới (chi tiết
// hiển thị), nhưng CÓ HAY KHÔNG một yêu cầu đang mở thì hỏi chain.
import { timelockView } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { TimelockCountdown } from "@/components/family/timelock-countdown";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import {
  chainTruthOptions,
  openOnchainRequest,
  recoveryOptions,
} from "@/features/family/api/recovery";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/block/")({ component: BlockAlertScreen });

function BlockAlertScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();

  const chain = useQuery({ ...chainTruthOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const mirror = useQuery({ ...recoveryOptions(wallet?.id ?? ""), enabled: wallet !== null });

  const open = openOnchainRequest(chain.data);
  const mirrorOpen = (mirror.data ?? []).find(
    (r) => r.status === "pending" || r.status === "ready",
  );
  const loading = walletLoading || chain.isLoading;

  // Lệch = mirror chưa bắt kịp chain. Tin chain, nói cho người dùng biết là
  // dữ liệu đang đồng bộ — đừng để họ tưởng app hỏng rồi bỏ đi.
  const outOfSync = !loading && !chain.isError && Boolean(open) !== Boolean(mirrorOpen);

  // Đếm ngược tính từ chain: mốc hết cửa sổ = bây giờ + số giây chain còn báo.
  const veto = open
    ? timelockView(new Date(Date.now() + open.timelockRemainingSecs * 1000).toISOString(), {
        locale: i18n.language,
      })
    : null;

  return (
    <ProductScreen className="justify-center">
      <span className="grid size-16 place-items-center rounded-full bg-destructive text-destructive-foreground">
        <Icon name="alertTriangle" size={32} />
      </span>
      <ScreenHeader title={t("block.alert.title")} description={t("block.alert.description")} />

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
            onClick={() => void chain.refetch()}
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

      {!loading && !walletError && !chain.isError && !open ? (
        <div className="flex flex-col gap-3">
          <EmptyState message={t("block.alert.nothingOpen")} />
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
    </ProductScreen>
  );
}
