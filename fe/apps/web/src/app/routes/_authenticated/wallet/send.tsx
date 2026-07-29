// Gửi tiền (PHA 6 SEND + WP3 fe-smooth) — nhập → review → ký (passkey) → nộp.
// KHÔNG gọi thẳng SAC: đi qua pipeline intent BE. Máy xác nhận→ký→nộp nằm ở
// features/family/hooks/use-send-machine (timeout ≠ thất bại, chống ký mù giữ
// nguyên fix P0). Màn review mount thì PRE-WARM kit passkey (nối phiên IndexedDB
// im lặng, không sinh trắc học, không side effect) để bấm "Xác nhận" là hộp
// thoại vân tay hiện không phải chờ.
import { ApiError, formatAmount } from "@repo/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AmountInput, useParsedAmount } from "@/components/amount-input";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";
import { guardiansOptions } from "@/features/family/api/guardians";
import { invitesOptions } from "@/features/family/api/invites";
import { prepareSend, type SendReview } from "@/features/family/api/send";
import {
  type RecipientContact,
  RecipientField,
} from "@/features/family/components/recipient-field";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { SendErrorBanner } from "@/features/family/components/send-error-banner";
import { lockCtaTo, WalletLockedNotice } from "@/features/family/components/wallet-locked";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { DefiniteSubmitFailure, useSendMachine } from "@/features/family/hooks/use-send-machine";
import { isSendableAddress } from "@/features/family/lib/address";
import {
  mapSendApiError,
  SEND_FALLBACK,
  type SendErrorView,
} from "@/features/family/lib/send-error";
import { walletSendLock } from "@/features/family/lib/wallet-lock";
import { ensureWalletConnected } from "@/features/wallet/lib/kit";
import { signWalletEntries, WalletSignError } from "@/features/wallet/lib/sign-wallet-entries";
import { BlindSignError } from "@/lib/auth-entry-guard";
import {
  Row,
  SendDoneScreen,
  SendGuardianWaitScreen,
  SendUnconfirmedScreen,
  Shell,
} from "./-send-screens";

export const Route = createFileRoute("/_authenticated/wallet/send")({
  component: WalletSendScreen,
});

const SEND_REVIEW_HISTORY_KEY = "__familyWalletSendReview";

/**
 * Lỗi → câu người đọc. Ba lớp lỗi CỦA RIÊNG MÀN NÀY xử ở đây (chúng là class
 * của FE, không đi qua HTTP); còn lại giao cho bảng map dùng chung.
 *
 * Trước 29/07 hàm này gộp mọi 4xx vào một câu "Chưa có gì được gửi đi" — kể cả
 * `403 WALLET_NOT_REGISTERED_FOR_SPONSORSHIP` vốn nói rõ nguyên nhân. Người dùng
 * thử lại đúng như câu đó bảo và hỏng y hệt, mãi mãi.
 */
function sendErrorView(err: unknown): SendErrorView {
  // Lệnh sắp ký KHÁC thứ người dùng nhập → dừng và nói thẳng, không gộp vào
  // "gửi không thành công": đây là dấu hiệu bị can thiệp, không phải lỗi mạng.
  if (err instanceof BlindSignError) return { title: "wallet.send.errors.tampered", action: null };
  // BE xác nhận nộp trượt (qua audit) — tiền chưa rời ví, làm lại từ đầu an toàn.
  if (err instanceof DefiniteSubmitFailure) return SEND_FALLBACK;
  if (err instanceof WalletSignError) {
    return err.message === "WALLET_NOT_CONNECTED"
      ? { title: "wallet.send.errors.walletLocked", action: null }
      : { ...SEND_FALLBACK, code: err.message };
  }
  if (err instanceof ApiError) return mapSendApiError(err);
  return SEND_FALLBACK;
}

function WalletSendScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();
  const [step, setStep] = useState<"enter" | "review">("enter");
  const [rawAmount, setRawAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [review, setReview] = useState<SendReview | null>(null);
  const parsed = useParsedAmount(rawAmount);
  // StrKey checksum (LÔ 4) — C/G gửi được; M nhận diện nhưng chặn có lời giải
  // thích trong RecipientField; regex [GC]{55} cũ cho qua địa chỉ gõ sai.
  const recipientValid = isSendableAddress(recipient);

  // Người thân đã biết (guardian có địa chỉ) — bấm là điền, hiện nhãn "Mẹ".
  const guardians = useQuery({
    ...guardiansOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });
  const contacts: RecipientContact[] = (guardians.data ?? [])
    .filter((g) => g.label !== null && g.onchainKey !== null)
    .map((g) => ({ label: g.label as string, address: g.onchainKey as string }));

  // Ví đã mở đường gửi chưa. Hub đã chặn bằng popup TRƯỚC khi vào đây; màn này
  // vẫn phải tự chặn vì người dùng có thể mở thẳng bằng link/bookmark.
  // CHỈ dùng nguồn RẺ (số người đã nhận lời, một query DB) — không kéo thêm
  // chain-truth vào đây: nó poll 20s và mỗi lượt tốn 3 lần simulate trên RPC.
  // Ca "đủ người nhưng chưa đăng ký" rơi xuống lưới thứ hai (map lỗi 403).
  const invites = useQuery({ ...invitesOptions(wallet?.id ?? ""), enabled: wallet !== null });
  const lock = walletSendLock({ recoverability: invites.data?.recoverability });
  const protectTo = lockCtaTo(lock.locked ? lock.step : "invite");

  const machine = useSendMachine({
    walletId: wallet?.id ?? null,
    walletAddress: wallet?.stellarAddress ?? null,
    signEntries: signWalletEntries,
  });

  const returnToEntry = useCallback(() => {
    machine.reset();
    setReview(null);
    setStep("enter");
  }, [machine.reset]);

  useEffect(() => {
    const onPopState = () => {
      if (step !== "review") return;
      if (machine.busy) {
        window.history.pushState(
          { ...window.history.state, [SEND_REVIEW_HISTORY_KEY]: true },
          "",
          window.location.href,
        );
        return;
      }
      returnToEntry();
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [machine.busy, returnToEntry, step]);

  const leaveReview = useCallback(() => {
    if (window.history.state?.[SEND_REVIEW_HISTORY_KEY]) {
      window.history.back();
      return;
    }
    returnToEntry();
  }, [returnToEntry]);

  // PRE-WARM lúc màn review mount: nối lại phiên kit từ IndexedDB để đường ký
  // không phải chờ bước này sau cú bấm. Im lặng tuyệt đối khi hỏng — người dùng
  // chưa yêu cầu gì; bấm nút vẫn đi đường cũ (ensureWalletConnected tự nối lại).
  useEffect(() => {
    if (step === "review") {
      void ensureWalletConnected().catch(() => {});
    }
  }, [step]);

  const prepare = useMutation({
    mutationFn: async (walletId: string) => {
      if (!parsed.ok) throw new Error("BAD_AMOUNT");
      return prepareSend({
        walletId,
        clientIntentId: crypto.randomUUID(),
        recipient: recipient.trim(),
        amountStroops: parsed.scaled,
      });
    },
    onSuccess: (r) => {
      setReview(r);
      setStep("review");
      window.history.pushState(
        { ...window.history.state, [SEND_REVIEW_HISTORY_KEY]: true },
        "",
        window.location.href,
      );
    },
  });

  if (isLoading) return <Shell>{<LoadingRows />}</Shell>;
  if (isError) return <Shell>{<ErrorState />}</Shell>;
  if (!wallet) return <Shell>{<EmptyState message={t("wallet.send.noWallet")} />}</Shell>;

  // CHẶN SỚM: ví chưa mở đường gửi thì KHÔNG mở form. Nói đủ ba tầng tại chỗ —
  // để người dùng không gõ số tiền, chọn người nhận rồi mới biết là vô ích.
  if (lock.locked && step === "enter") {
    return (
      <Shell>
        <WalletLockedNotice lock={lock} />
      </Shell>
    );
  }

  if (machine.phase === "settled") return <SendDoneScreen txHash={machine.txHash} />;
  if (machine.phase === "awaiting_guardian") {
    return (
      <SendGuardianWaitScreen intentId={review?.intentId ?? null} onCancelled={returnToEntry} />
    );
  }
  if (machine.phase === "unconfirmed") {
    return <SendUnconfirmedScreen pollExhausted={machine.pollExhausted} />;
  }

  if (step === "review" && review) {
    const err = machine.error !== null ? sendErrorView(machine.error) : null;
    const startOver = machine.error instanceof DefiniteSubmitFailure;
    const progressKey =
      machine.phase === "confirming"
        ? "wallet.send.progress.confirming"
        : machine.phase === "signing"
          ? "wallet.send.review.signing"
          : machine.phase === "submitting"
            ? "wallet.send.progress.submitting"
            : null;
    return (
      <Shell>
        <ScreenHeader title={t("wallet.send.review.title")} />
        <Card className="bg-paper-2">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="border-b pb-5 text-center">
              <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.06em]">
                {t("wallet.send.review.amount")}
              </p>
              <p className="product-money">
                {formatAmount(review.amount, { locale: i18n.language, code: "XLM" })}
              </p>
            </div>
            <Row label={t("wallet.send.review.to")}>
              <span className="font-mono text-sm">
                {`${review.recipient.slice(0, 6)}…${review.recipient.slice(-6)}`}
              </span>
            </Row>
            {/* C5 lô policy — địa chỉ LẠ: cảnh báo mềm, không chặn (chặn nằm ở
                ngưỡng per_tx/daily; địa chỉ lạ tự nó không còn bắt duyệt). */}
            {review.knownRecipient === false ? (
              <ErrorBanner type="warn" title={t("wallet.send.review.unknownRecipient")} />
            ) : null}
            <div className="flex items-center gap-3 rounded-card border border-dashed bg-card p-4">
              <Icon name="fingerprint" size={32} />
              <p className="text-muted-foreground text-sm">
                {t("wallet.send.review.biometricNote")}
              </p>
            </div>
            {progressKey ? <ErrorBanner type="pending" title={t(progressKey)} /> : null}
            {err ? (
              <SendErrorBanner view={err} protectTo={protectTo} onStartOver={leaveReview} />
            ) : null}
            <PrimaryZone>
              {startOver ? (
                <Button onClick={leaveReview}>{t("wallet.send.startOverCta")}</Button>
              ) : (
                <Button
                  loading={machine.busy}
                  onClick={() =>
                    void machine.start(review, {
                      recipient: recipient.trim(),
                      amountStroops: parsed.ok ? parsed.scaled : "",
                    })
                  }
                >
                  <Icon name="fingerprint" />
                  {progressKey ? t(progressKey) : t("wallet.send.review.cta")}
                </Button>
              )}
              <Button variant="ghost" disabled={machine.busy} onClick={leaveReview}>
                {t("wallet.send.review.backCta")}
              </Button>
            </PrimaryZone>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const err = prepare.isError ? sendErrorView(prepare.error) : null;
  return (
    <Shell>
      <ScreenHeader title={t("wallet.send.title")} description={t("wallet.send.description")} />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed.ok && recipientValid) prepare.mutate(wallet.id);
        }}
      >
        <label htmlFor="send-amount" className="flex flex-col gap-1">
          <span className="text-foreground text-sm">{t("wallet.send.amountLabel")}</span>
          <AmountInput id="send-amount" value={rawAmount} onChange={setRawAmount} assetCode="XLM" />
        </label>
        <RecipientField value={recipient} onChange={setRecipient} contacts={contacts} />
        {err ? <SendErrorBanner view={err} protectTo={protectTo} /> : null}
        <Button type="submit" loading={prepare.isPending} disabled={!parsed.ok || !recipientValid}>
          {prepare.isPending ? t("wallet.send.checking") : t("wallet.send.cta")}
        </Button>
      </form>
    </Shell>
  );
}
