// "Lệnh đang chờ bạn ký" — vá ngõ cụt L2 (2026-07-30).
//
// Chuyện đã xảy ra với ví thật: người thân bấm duyệt lúc 16:57:47, BE mở khoá ký
// đúng như thiết kế, chủ ví nhận cả email lẫn toast "đã duyệt" — rồi hết. Màn
// chờ không tự đổi, không có nút nào, và endpoint `/signable` chưa từng được gọi
// một lần nào trong toàn bộ log. Tiền đứng im, chủ ví không biết chuyện gì.
//
// File tiền tố `-` = TanStack Router bỏ qua khi sinh route tree (co-located).
// Nó nằm ở TẦNG APP vì phải ghép hai feature (family: danh sách + máy ký;
// wallet: passkey) — luật module cấm feature import feature, tầng app thì được.
import { formatAmount } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import {
  type PendingSignature,
  pendingSignatureOptions,
} from "@/features/family/api/pending-signature";
import { SendErrorBanner } from "@/features/family/components/send-error-banner";
import { useResumeSigning } from "@/features/family/hooks/use-resume-signing";
import {
  mapSendApiError,
  SEND_FALLBACK,
  type SendErrorView,
} from "@/features/family/lib/send-error";
import { ensureWalletConnected } from "@/features/wallet/lib/kit";
import { signWalletEntries, WalletSignError } from "@/features/wallet/lib/sign-wallet-entries";
import { ApiError } from "@/lib/api-client";
import { BlindSignError } from "@/lib/auth-entry-guard";
import { explorerTxUrl } from "@/lib/stellar-explorer";

/** Poll dự phòng khi màn đang mở: SSE at-most-once và đã từng chết cả kênh. */
const POLL_MS = 10_000;

function resumeErrorView(err: unknown): SendErrorView {
  if (err instanceof BlindSignError) return { title: "wallet.send.errors.tampered", action: null };
  if (err instanceof WalletSignError) {
    return err.message === "WALLET_NOT_CONNECTED"
      ? { title: "wallet.send.errors.walletLocked", action: null }
      : { ...SEND_FALLBACK, code: err.message };
  }
  if (err instanceof ApiError) return mapSendApiError(err);
  return SEND_FALLBACK;
}

/** Danh sách lệnh chờ ký + trạng thái ký, dùng chung cho hub ví và màn chờ duyệt. */
export function usePendingSignature(opts?: { poll?: boolean }) {
  return useQuery({
    ...pendingSignatureOptions,
    ...(opts?.poll ? { refetchInterval: POLL_MS } : {}),
  });
}

/**
 * "Đã gửi xong" + mã giao dịch. Tách ra để dùng được cả khi dòng chờ ký ĐÃ BIẾN
 * MẤT: ký thành công thì BE thôi trả lệnh đó ở `/pending-signature`, nên chỗ nào
 * treo kết quả vào chính dòng đó sẽ tự xoá lời báo thành công của mình.
 */
export function SignedNotice({ txHash }: { txHash: string | null }) {
  const { t } = useTranslation("fw");
  return (
    <div className="flex flex-col gap-1" data-testid="pending-signature-sent">
      <ErrorBanner type="info" title={t("wallet.pendingSignature.sentTitle")} />
      {txHash ? (
        <a
          href={explorerTxUrl(txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center break-all font-mono text-muted-foreground text-xs underline"
        >
          {t("wallet.send.done.txLabel", { hash: `${txHash.slice(0, 8)}…` })}
        </a>
      ) : null}
    </div>
  );
}

export function PendingSignatureRow({
  item,
  signing,
}: {
  item: PendingSignature;
  signing: ReturnType<typeof useResumeSigning>;
}) {
  const { t, i18n } = useTranslation("fw");
  const mine = signing.activeIntentId === item.intent_id;
  const busy = mine && signing.busy;

  return (
    <div className="flex flex-col gap-3 rounded-card border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-bold text-foreground text-lg">
          {item.amount
            ? formatAmount(item.amount, { locale: i18n.language, code: "XLM" })
            : t("wallet.pendingSignature.noAmount")}
        </span>
        <span className="text-muted-foreground text-xs">
          {t("wallet.pendingSignature.approvedBadge")}
        </span>
      </div>

      {/* Địa chỉ ĐẦY ĐỦ, không rút gọn: đây chính là giá trị máy ký đem đối chiếu
          với auth entry trước khi mở sinh trắc học. Rút gọn nó là biến việc
          "thấy gì ký nấy" thành lời hứa suông. */}
      {item.recipient ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {t("wallet.pendingSignature.toLabel")}
          </span>
          <span className="break-all font-mono text-foreground text-xs leading-relaxed">
            {item.recipient}
          </span>
        </div>
      ) : null}

      <p className="text-muted-foreground text-sm">{t("wallet.pendingSignature.whyBody")}</p>

      {mine && signing.phase === "settled" ? <SignedNotice txHash={signing.txHash} /> : null}

      {mine && signing.phase === "failed" ? (
        <SendErrorBanner view={resumeErrorView(signing.error)} protectTo="/setup/review" />
      ) : null}

      {mine && signing.phase === "settled" ? null : (
        <Button
          loading={busy}
          onClick={() =>
            void signing.run({
              intentId: item.intent_id,
              from: item.from,
              recipient: item.recipient,
              amountStroops: item.amount,
            })
          }
          data-testid="pending-signature-sign"
        >
          <Icon name="send" />
          {busy ? t("wallet.pendingSignature.signingCta") : t("wallet.pendingSignature.signCta")}
        </Button>
      )}
    </div>
  );
}

/**
 * MỘT lệnh trên màn chờ duyệt + PRE-WARM kit passkey.
 *
 * Máy ký do CHA truyền vào, KHÔNG tạo ở đây (2026-07-30): ký xong lệnh rời danh
 * sách `/pending-signature`, component này unmount theo, và state ký chết cùng nó
 * — cha mất đường biết là đã gửi xong. Cha giữ state thì cha đổi được sang màn
 * "Đã gửi".
 */
export function PendingSignatureSolo({
  item,
  signing,
}: {
  item: PendingSignature;
  signing: ReturnType<typeof useResumeSigning>;
}) {
  useEffect(() => {
    void ensureWalletConnected().catch(() => {});
  }, []);
  return <PendingSignatureRow item={item} signing={signing} />;
}

/**
 * Thẻ trên hub ví — ĐƯỜNG VỀ sau khi đóng tab / F5. Không có nó thì `intentId`
 * chỉ sống trong state của tab đang mở và lệnh coi như mất.
 * Rỗng thì KHÔNG render gì: hub ví không cần một ô trống nói "không có gì".
 */
export function PendingSignatureCard() {
  const { t } = useTranslation("fw");
  const pending = usePendingSignature();
  const signing = useResumeSigning({ signEntries: signWalletEntries });

  // PRE-WARM kit passkey khi có lệnh chờ — nối lại phiên IndexedDB im lặng,
  // không sinh trắc học, để cú bấm "Ký ngay" mở được hộp thoại vân tay ngay.
  const hasItems = (pending.data?.length ?? 0) > 0;
  useEffect(() => {
    if (hasItems) void ensureWalletConnected().catch(() => {});
  }, [hasItems]);

  // Ký NGAY TỪ HUB: lệnh vừa ký rời danh sách, dòng của nó unmount, và lời báo
  // "đã gửi" đi theo — người dùng thấy thẻ tự rỗng đi mà không ai nói tiền đã đi
  // hay chưa. Giữ thẻ sống thêm để nói ra, kèm mã giao dịch.
  const items = pending.data ?? [];
  const justSent =
    signing.phase === "settled" && !items.some((i) => i.intent_id === signing.activeIntentId);

  if (items.length === 0 && !justSent) return null;
  return (
    <Card data-testid="pending-signature-card">
      <CardHeader>
        <CardTitle className="text-sm">
          {justSent && items.length === 0
            ? t("wallet.pendingSignature.sentTitle")
            : t("wallet.pendingSignature.title", { count: items.length })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {justSent ? <SignedNotice txHash={signing.txHash} /> : null}
        {items.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("wallet.pendingSignature.description")}
          </p>
        ) : null}
        {items.map((item) => (
          <PendingSignatureRow key={item.intent_id} item={item} signing={signing} />
        ))}
      </CardContent>
    </Card>
  );
}
