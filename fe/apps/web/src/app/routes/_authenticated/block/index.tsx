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
//
// R7 — bốn nhánh hiển thị nằm ở `-block-alert-body.tsx` để test được bằng DOM
// thật; file này chỉ còn nối dây query.
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { chainTruthOptions, recoveryOptions } from "@/features/family/api/recovery";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { BlockAlertBody } from "./-block-alert-body";

export const Route = createFileRoute("/_authenticated/block/")({ component: BlockAlertScreen });

function BlockAlertScreen() {
  const { t } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();

  const chain = useQuery({ ...chainTruthOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const mirror = useQuery({ ...recoveryOptions(wallet?.id ?? ""), enabled: wallet !== null });

  const mirrorOpen = (mirror.data ?? []).find(
    (r) => r.status === "pending" || r.status === "ready",
  );

  return (
    <ProductScreen className="justify-center">
      <span className="grid size-16 place-items-center rounded-full bg-destructive text-destructive-foreground">
        <Icon name="alertTriangle" size={32} />
      </span>
      <ScreenHeader title={t("block.alert.title")} description={t("block.alert.description")} />

      <BlockAlertBody
        walletLoading={walletLoading}
        walletError={walletError}
        chain={{
          isLoading: chain.isLoading,
          isError: chain.isError,
          isSuccess: chain.isSuccess,
          isFetching: chain.isFetching,
          data: chain.data,
          refetch: () => void chain.refetch(),
        }}
        mirrorOpen={mirrorOpen}
      />
    </ProductScreen>
  );
}
