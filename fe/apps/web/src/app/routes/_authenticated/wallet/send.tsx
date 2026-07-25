// Gửi tiền (PHA 6 SEND + WP3 fe-smooth) — nhập → review → ký (passkey) → nộp.
// KHÔNG gọi thẳng SAC: đi qua pipeline intent BE. Máy xác nhận→ký→nộp nằm ở
// features/family/hooks/use-send-machine (timeout ≠ thất bại, chống ký mù giữ
// nguyên fix P0). Màn review mount thì PRE-WARM kit passkey (nối phiên IndexedDB
// im lặng, không sinh trắc học, không side effect) để bấm "Xác nhận" là hộp
// thoại vân tay hiện không phải chờ.
import { ApiError, formatAmount } from "@repo/core";
import { Button, Card, CardContent, Input } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AmountInput, useParsedAmount } from "@/components/amount-input";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ScreenHeader } from "@/components/family/screen";
import { prepareSend, type SendReview } from "@/features/family/api/send";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { DefiniteSubmitFailure, useSendMachine } from "@/features/family/hooks/use-send-machine";
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

const ADDRESS_RE = /^[GC][A-Z2-7]{55}$/;

type SendErrorKey =
  | "wallet.send.errors.insufficient"
  | "wallet.send.errors.badRecipient"
  | "wallet.send.errors.delayed"
  | "wallet.send.errors.walletLocked"
  | "wallet.send.errors.network"
  | "wallet.send.errors.tampered"
  | "wallet.send.errors.notSent";

function sendErrorKey(err: unknown): { key: SendErrorKey; shortfall?: string | undefined } {
  // Lệnh sắp ký KHÁC thứ người dùng nhập → dừng và nói thẳng, không gộp vào
  // "gửi không thành công": đây là dấu hiệu bị can thiệp, không phải lỗi mạng.
  if (err instanceof BlindSignError) return { key: "wallet.send.errors.tampered" };
  // BE xác nhận nộp trượt (qua audit) — tiền chưa rời ví, làm lại từ đầu an toàn.
  if (err instanceof DefiniteSubmitFailure) return { key: "wallet.send.errors.notSent" };
  if (err instanceof WalletSignError) {
    return {
      key:
        err.message === "WALLET_NOT_CONNECTED"
          ? "wallet.send.errors.walletLocked"
          : "wallet.send.errors.notSent",
    };
  }
  if (err instanceof ApiError) {
    const data = err.data as { error?: { message?: string } } | null;
    const msg = data?.error?.message ?? "";
    if (msg.startsWith("INSUFFICIENT_BALANCE")) {
      // message dạng "INSUFFICIENT_BALANCE:{...json}"
      try {
        const detail = JSON.parse(msg.slice(msg.indexOf(":") + 1)) as { shortfall?: string };
        return { key: "wallet.send.errors.insufficient", shortfall: detail.shortfall };
      } catch {
        return { key: "wallet.send.errors.insufficient" };
      }
    }
    if (msg.startsWith("BAD_RECIPIENT") || msg.startsWith("SELF_TRANSFER")) {
      return { key: "wallet.send.errors.badRecipient" };
    }
    if (msg.startsWith("POLICY_DELAY")) return { key: "wallet.send.errors.delayed" };
    if (err.status >= 500) return { key: "wallet.send.errors.network" };
  }
  return { key: "wallet.send.errors.notSent" };
}

function WalletSendScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading, isError } = useActiveWallet();
  const [step, setStep] = useState<"enter" | "review">("enter");
  const [rawAmount, setRawAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [review, setReview] = useState<SendReview | null>(null);
  const parsed = useParsedAmount(rawAmount);
  const recipientValid = ADDRESS_RE.test(recipient.trim());

  const machine = useSendMachine({
    walletId: wallet?.id ?? null,
    walletAddress: wallet?.stellarAddress ?? null,
    signEntries: signWalletEntries,
  });

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
    },
  });

  if (isLoading) return <Shell>{<LoadingRows />}</Shell>;
  if (isError) return <Shell>{<ErrorState />}</Shell>;
  if (!wallet) return <Shell>{<EmptyState message={t("wallet.send.noWallet")} />}</Shell>;

  if (machine.phase === "settled") return <SendDoneScreen txHash={machine.txHash} />;
  if (machine.phase === "awaiting_guardian") return <SendGuardianWaitScreen />;
  if (machine.phase === "unconfirmed") {
    return <SendUnconfirmedScreen pollExhausted={machine.pollExhausted} />;
  }

  if (step === "review" && review) {
    const err = machine.error !== null ? sendErrorKey(machine.error) : null;
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
            <div className="flex items-center gap-3 rounded-card border border-dashed bg-card p-4">
              <Icon name="fingerprint" size={32} />
              <p className="text-muted-foreground text-sm">
                {t("wallet.send.review.biometricNote")}
              </p>
            </div>
            {progressKey ? <ErrorBanner type="pending" title={t(progressKey)} /> : null}
            {err ? (
              <ErrorBanner type="error" title={t(err.key, { shortfall: err.shortfall ?? "" })} />
            ) : null}
            <PrimaryZone>
              {startOver ? (
                <Button
                  onClick={() => {
                    machine.reset();
                    setStep("enter");
                  }}
                >
                  {t("wallet.send.startOverCta")}
                </Button>
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
              <Button
                variant="ghost"
                disabled={machine.busy}
                onClick={() => {
                  machine.reset();
                  setStep("enter");
                }}
              >
                {t("wallet.send.review.backCta")}
              </Button>
            </PrimaryZone>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const err = prepare.isError ? sendErrorKey(prepare.error) : null;
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
        <label htmlFor="send-recipient" className="flex flex-col gap-1">
          <span className="text-foreground text-sm">{t("wallet.send.recipientLabel")}</span>
          <Input
            id="send-recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="C…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={recipient.length > 0 && !recipientValid}
          />
          {recipient.length > 0 && !recipientValid ? (
            <span className="text-destructive text-xs">{t("wallet.send.errors.badRecipient")}</span>
          ) : null}
        </label>
        {err ? (
          <ErrorBanner type="error" title={t(err.key, { shortfall: err.shortfall ?? "" })} />
        ) : null}
        <Button type="submit" loading={prepare.isPending} disabled={!parsed.ok || !recipientValid}>
          {prepare.isPending ? t("wallet.send.checking") : t("wallet.send.cta")}
        </Button>
      </form>
    </Shell>
  );
}
