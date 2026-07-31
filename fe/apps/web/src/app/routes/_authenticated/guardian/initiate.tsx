// Màn guardian MỞ khôi phục (PHA 6 cụm GHI) — từ "tiếng gõ cửa" của thiết bị
// mới. Ba hàng rào trước khi chữ ký rời máy:
//   1. Xác minh NGOÀI BĂNG: gọi cho chủ ví, đọc mã chìa khoá cho nhau nghe.
//   2. Chống-ký-mù TỰ ĐỘNG (audit P0): sau khi BE build entry, decode và so
//      fingerprint Signer TRONG ENTRY với mã đã hiện — BE bị chiếm mà tráo
//      khoá là hai phía lệch nhau → DỪNG, không ký.
//   3. Cổng sinh trắc học = chính prompt passkey.
// R5: phân loại lỗi ký qua @/lib/recovery-sign-outcome — phiên ví hết hạn thì
// chạm vân tay xin lại phiên (một lần), không bắt đăng xuất.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ReconfirmSign } from "@/components/family/reconfirm-sign";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";
import {
  type GuardianDeviceRequestItem,
  guardianDeviceRequestsOptions,
  guardianInboxKeys,
} from "@/features/family/api/guardian-inbox";
import { buildRecoveryAction, submitRecoveryAction } from "@/features/family/api/recovery-actions";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import {
  fingerprintMatchesMirror,
  initiateSignerFingerprint,
} from "@/features/family/lib/entry-fingerprint";
import { useWalletReconfirm } from "@/features/wallet/hooks/use-wallet-reconfirm";
import { signRecoveryEntries } from "@/features/wallet/lib/sign-recovery-entries";
import { initiateOutcome } from "@/lib/recovery-sign-outcome";

export const Route = createFileRoute("/_authenticated/guardian/initiate")({
  validateSearch: z.object({ wallet: z.string().catch("") }),
  component: GuardianInitiateScreen,
});

class SignerMismatchError extends Error {
  constructor() {
    super("SIGNER_MISMATCH");
    this.name = "SignerMismatchError";
  }
}

async function initiateFlow(item: GuardianDeviceRequestItem) {
  const built = await buildRecoveryAction({
    action: "initiate",
    walletId: item.wallet.id,
    newSigner: {
      verifier: item.deviceRequest.verifier,
      keyBase64: item.deviceRequest.keyBase64,
    },
  });
  // Hàng rào 2: khoá TRONG entry phải trùng mã đã hiện — lệch là dừng.
  for (const entryB64 of built.auth_entries_xdr) {
    const fp = await initiateSignerFingerprint(entryB64);
    if (fp !== null && !fingerprintMatchesMirror(fp, item.deviceRequest.fingerprint)) {
      throw new SignerMismatchError();
    }
  }
  const signed = await signRecoveryEntries({
    entriesXdr: built.auth_entries_xdr,
    latestLedger: built.latest_ledger,
  });
  return submitRecoveryAction({ walletId: item.wallet.id, signedEntriesXdr: signed });
}

function GuardianInitiateScreen() {
  const { t } = useTranslation("fw");
  const { wallet: walletId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const requests = useQuery(guardianDeviceRequestsOptions);
  const item = (requests.data ?? []).find((i) => i.wallet.id === walletId);
  const reconfirm = useWalletReconfirm();

  const initiate = useMutation({
    mutationFn: initiateFlow,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: guardianInboxKeys.all });
      await queryClient.invalidateQueries({ queryKey: guardianInboxKeys.deviceRequests });
      await navigate({ to: "/guardian/approved", search: { tx: result.hash } });
    },
  });

  const outcome = initiate.isError ? initiateOutcome(initiate.error) : null;

  return (
    <ProductScreen className="justify-center">
      <ScreenHeader
        title={t("guardian.initiate.title")}
        description={t("guardian.initiate.description")}
      />

      {requests.isLoading ? <LoadingRows /> : null}
      {requests.isError ? <ErrorState /> : null}
      {requests.data && !item ? (
        <div className="flex flex-col gap-3">
          <EmptyState message={t("guardian.initiate.gone")} />
          <Button asChild variant="outline">
            <Link to="/guardian">{t("guardian.initiate.backCta")}</Link>
          </Button>
        </div>
      ) : null}

      {item ? (
        <Card className="bg-paper-2">
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="break-all rounded-card border border-dashed bg-card p-4 font-mono text-muted-foreground text-xs">
              {t("guardian.initiate.fingerprintLabel", {
                fingerprint: item.deviceRequest.fingerprint,
              })}
            </p>
            <ErrorBanner type="warn" title={t("guardian.initiate.title")}>
              {t("guardian.initiate.verifyNote")}
            </ErrorBanner>

            {/* Lô R1 — HƯỚNG DẪN xác minh, không phải hàng rào cưỡng chế. Hàng
                rào thật là đủ phiếu + khoảng chờ + quyền chặn, nằm on-chain.
                Đặt NGAY TRÊN nút duyệt và luôn mở: người dùng lớn tuổi, thứ gì
                phải bấm để đọc thì coi như không tồn tại. CỐ Ý không gợi ý câu
                hỏi cụ thể — gợi ý cụ thể vừa dạy kẻ trộm cần chuẩn bị gì, vừa
                làm người bảo hộ tưởng đã kiểm tra xong khi thực ra chưa. */}
            <section
              className="flex flex-col gap-2 rounded-card border border-primary bg-accent p-4"
              aria-label={t("guardian.initiate.verify.title")}
            >
              <h2 className="font-semibold text-foreground text-sm">
                {t("guardian.initiate.verify.title")}
              </h2>
              <p className="text-foreground text-sm">
                {t("guardian.initiate.verify.pickQuestion")}
              </p>
              <p className="text-muted-foreground text-sm">{t("guardian.initiate.verify.avoid")}</p>
              <p className="font-semibold text-foreground text-sm">
                {t("guardian.initiate.verify.unsure")}
              </p>
              <p className="text-muted-foreground text-sm">{t("guardian.initiate.verify.rush")}</p>
            </section>

            <div className="flex items-center gap-3">
              <Icon name="fingerprint" size={32} />
              <p className="text-muted-foreground text-sm">
                {t("guardian.initiate.biometricNote")}
              </p>
            </div>

            {/* R4-D4: contract đếm NGƯỜI MỞ là phiếu đầu tiên — nói trước để
                không ai mở xong lại đi bấm duyệt và gặp "đã bỏ phiếu rồi". */}
            <p className="text-foreground text-sm" role="note">
              {t("guardian.initiate.countsAsVote")}
            </p>

            {outcome?.kind === "reconfirm" ? (
              // Phiên ví hết — máy VẪN CÓ passkey: chạm vân tay xin lại phiên,
              // KHÔNG bắt đăng xuất (§4, đúng MỘT lần thử lại).
              <ReconfirmSign
                phase={reconfirm.phase}
                onStart={() => reconfirm.start(() => initiate.mutate(item))}
              />
            ) : null}
            {outcome?.kind === "error" ? <ErrorBanner type="error" title={t(outcome.key)} /> : null}

            <PrimaryZone>
              <Button loading={initiate.isPending} onClick={() => initiate.mutate(item)}>
                <Icon name="fingerprint" />
                {initiate.isPending ? t("guardian.initiate.signing") : t("guardian.initiate.cta")}
              </Button>
              <Button asChild variant="ghost" disabled={initiate.isPending}>
                <Link to="/guardian">{t("guardian.initiate.backCta")}</Link>
              </Button>
            </PrimaryZone>
          </CardContent>
        </Card>
      ) : null}
    </ProductScreen>
  );
}
