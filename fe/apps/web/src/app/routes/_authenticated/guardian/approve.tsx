// Màn BỎ PHIẾU của guardian (PHA 6 cụm GHI). Cổng sinh trắc học = prompt
// passkey khi ký entry approve. Phiếu on-chain gắn với YÊU CẦU đang mở trên
// mạng (vật liệu khoá mới đã chốt lúc initiate) — màn hiện fingerprint từ
// mirror-chain để người bảo hộ đối chiếu với người thân qua kênh ngoài.
// R5: phân loại lỗi ký qua @/lib/recovery-sign-outcome (phiên ví hết ≠ sai máy;
// lệnh đã đóng = tin tốt), thẻ đang xem mà lệnh đóng → đổi màn "đã đóng".
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { GuardianPortrait, guardianPortraitForIndex } from "@/components/family/guardian-portrait";
import { Icon } from "@/components/family/icons";
import { ReconfirmSign } from "@/components/family/reconfirm-sign";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { SuccessNote } from "@/components/family/success-note";
import { Button, Card, CardContent } from "@/components/family/ui";
import { guardianInboxKeys, guardianInboxOptions } from "@/features/family/api/guardian-inbox";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useWalletReconfirm } from "@/features/wallet/hooks/use-wallet-reconfirm";
import { signRecoveryEntries } from "@/features/wallet/lib/sign-recovery-entries";
import { assertApproveRecoveryEntry, BlindSignError } from "@/lib/auth-entry-guard";
import { env } from "@/lib/env";
import { approveOutcome } from "@/lib/recovery-sign-outcome";

export const Route = createFileRoute("/_authenticated/guardian/approve")({
  validateSearch: z.object({ wallet: z.string().catch("") }),
  // R6 — nạp hộp thư TRƯỚC khi vẽ. Không có loader thì component render một
  // frame với `inbox.data === undefined`, nút "Duyệt" hiện ra rồi mới biến mất
  // khi dữ liệu về; người bấm nhanh vẫn lọt vào đường ký của một phiếu đã bỏ.
  loader: ({ context }) => context.queryClient.ensureQueryData(guardianInboxOptions),
  component: GuardianApproveScreen,
});

function GuardianApproveScreen() {
  const { t } = useTranslation("fw");
  const { wallet: walletId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inbox = useQuery(guardianInboxOptions);
  const item = (inbox.data ?? []).find((i) => i.wallet.id === walletId);
  const reconfirm = useWalletReconfirm();

  // C3: đã từng THẤY yêu cầu trên màn này mà giờ biến mất (SSE recovery.closed
  // → invalidate ["family"] → refetch) = lệnh vừa đóng ngay dưới chân họ —
  // đổi sang màn tin tốt, đừng hiện "không tìm thấy" khô khốc.
  const sawItem = useRef(false);
  if (item) sawItem.current = true;

  const approve = useMutation({
    mutationFn: async (id: string) => {
      // Địa chỉ ví đang duyệt lấy từ hộp thư guardian (ví người bảo hộ đã CHỌN),
      // registry lấy từ env FE — không lấy từ phản hồi build của backend.
      const target = (inbox.data ?? []).find((i) => i.wallet.id === id);
      if (!env.VITE_RECOVERY_REGISTRY_ADDRESS) throw new BlindSignError("ENTRY_WRONG_CONTRACT");
      if (!target) throw new BlindSignError("ENTRY_WRONG_SOURCE");
      const built = await buildRecoveryAction({ action: "approve", walletId: id });
      // CHỐNG KÝ MÙ: entry PHẢI là `approve_recovery` trên registry cho ĐÚNG ví —
      // một entry `transfer` từ ví người bảo hộ (backend bị chiếm) bị chối ở đây,
      // TRƯỚC khi chạm passkey.
      for (const entryXdr of built.auth_entries_xdr) {
        assertApproveRecoveryEntry(entryXdr, {
          registry: env.VITE_RECOVERY_REGISTRY_ADDRESS,
          wallet: target.wallet.stellarAddress,
        });
      }
      const signed = await signRecoveryEntries({
        entriesXdr: built.auth_entries_xdr,
        latestLedger: built.latest_ledger,
      });
      return submitRecoveryAction({ walletId: id, signedEntriesXdr: signed });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: guardianInboxKeys.all });
      await navigate({ to: "/guardian/approved", search: { tx: result.hash } });
    },
    onError: async (err) => {
      // Phiếu đã trên mạng / lệnh đã đóng mà mirror chưa kịp khớp → refetch để
      // màn hình đuổi kịp chain.
      const kind = approveOutcome(err).kind;
      if (kind === "recorded" || kind === "closed") {
        await queryClient.invalidateQueries({ queryKey: guardianInboxKeys.all });
      }
    },
  });

  const outcome = approve.isError ? approveOutcome(approve.error) : null;
  // R4-D5: AlreadyApproved KHÔNG phải lỗi — phiếu của bạn ĐÃ nằm trên mạng
  // (người mở yêu cầu được contract đếm là phiếu ĐẦU TIÊN, không cần bỏ lại).
  // R6: `viewerApproved` biết điều đó TRƯỚC khi bấm, nên nút không bao giờ hiện
  // ra cho người đã ký; `outcome` ở lại làm lưới đỡ cho race (hai máy cùng bấm).
  const done =
    item?.viewerApproved === true || outcome?.kind === "recorded" || outcome?.kind === "closed";

  return (
    <ProductScreen className="justify-center">
      <ScreenHeader
        title={t("guardian.approve.title")}
        description={t("guardian.approve.description")}
      />

      {inbox.isLoading ? <LoadingRows /> : null}
      {inbox.isError ? <ErrorState /> : null}
      {inbox.data && !item ? (
        <div className="flex flex-col gap-3">
          {sawItem.current ? (
            <SuccessNote
              title={t("guardian.approve.closed.title")}
              body={t("guardian.approve.closed.body")}
            />
          ) : (
            <EmptyState message={t("guardian.approve.gone")} />
          )}
          <Button asChild variant="outline">
            <Link to="/guardian">{t("guardian.approve.backCta")}</Link>
          </Button>
        </div>
      ) : null}

      {item ? (
        <Card className="bg-paper-2">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center gap-3">
              <GuardianPortrait
                variant={guardianPortraitForIndex(1)}
                className="size-16 rounded-full"
              />
              <p className="font-semibold text-foreground">
                {t("guardian.approve.votes", {
                  approvals: item.request.approvals,
                  threshold: item.request.threshold ?? item.wallet.threshold,
                })}
              </p>
            </div>

            {/* R6 — người ĐÃ ký: tích xanh + KHÔNG nút ký (xem `alreadyDone` dưới).
                Trước lô này nút vẫn sáng, họ chạm vân tay rồi mới ăn
                `AlreadyApproved` — báo lỗi sau khi đã bắt người ta trả giá. */}
            {item.viewerApproved ? (
              <SuccessNote
                title={t("guardian.approve.already.title")}
                body={t("guardian.approve.already.body")}
              />
            ) : null}
            {item.request.status === "ready" ? (
              <ErrorBanner type="info" title={t("guardian.inbox.thresholdMet")} />
            ) : null}
            <p className="break-all rounded-card border border-dashed bg-card p-4 font-mono text-muted-foreground text-xs">
              {t("guardian.approve.fingerprintLabel", { fingerprint: item.request.newOwner })}
            </p>
            <ErrorBanner type="warn" title={t("guardian.approve.title")}>
              {t("guardian.approve.verifyNote")}
            </ErrorBanner>
            <div className="flex items-center gap-3">
              <Icon name="fingerprint" size={32} />
              <p className="text-muted-foreground text-sm">{t("guardian.approve.biometricNote")}</p>
            </div>

            {outcome?.kind === "recorded" ? (
              // Tích XANH, không phải khối lỗi đỏ: chuyện cần nói là "xong rồi".
              <SuccessNote
                title={t("guardian.approve.recorded.title")}
                body={t("guardian.approve.recorded.body")}
              />
            ) : null}
            {outcome?.kind === "closed" ? (
              // Lệnh đã đóng = TIN TỐT — chủ ví đã vào lại được ví.
              <SuccessNote
                title={t("guardian.approve.closed.title")}
                body={t("guardian.approve.closed.body")}
              />
            ) : null}
            {outcome?.kind === "reconfirm" ? (
              // Phiên ví hết — máy VẪN CÓ passkey: chạm vân tay xin lại phiên,
              // KHÔNG bắt đăng xuất (§4, đúng MỘT lần thử lại).
              <ReconfirmSign
                phase={reconfirm.phase}
                onStart={() => reconfirm.start(() => approve.mutate(item.wallet.id))}
              />
            ) : null}
            {outcome?.kind === "error" ? <ErrorBanner type="error" title={t(outcome.key)} /> : null}

            <PrimaryZone>
              {done ? null : (
                <Button loading={approve.isPending} onClick={() => approve.mutate(item.wallet.id)}>
                  <Icon name="fingerprint" />
                  {approve.isPending ? t("guardian.approve.signing") : t("guardian.approve.cta")}
                </Button>
              )}
              <Button asChild variant="ghost" disabled={approve.isPending}>
                <Link to="/guardian">{t("guardian.approve.backCta")}</Link>
              </Button>
            </PrimaryZone>
          </CardContent>
        </Card>
      ) : null}
    </ProductScreen>
  );
}
