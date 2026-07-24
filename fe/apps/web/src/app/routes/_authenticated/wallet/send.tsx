// Gửi tiền (PHA 6 SEND) — máy state 4 bước: nhập → review → ký (cổng sinh trắc
// học = prompt passkey) → xong. KHÔNG gọi thẳng SAC: đi qua pipeline intent BE.
// Dùng module tiền PHA 7.1 (AmountInput RAW + parse theo locale — cấm format tự
// chế). Vượt ngưỡng → màn "chờ người thân duyệt". Taxonomy lỗi "tiền đã đi chưa".
import { ApiError, formatAmount } from "@repo/core";
import { Button, Card, CardContent, Input } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AmountInput, useParsedAmount } from "@/components/amount-input";
import {
  type ConfirmResult,
  confirmSend,
  prepareSend,
  type SendReview,
  signSend,
} from "@/features/family/api/send";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";
import { signWalletEntries, WalletSignError } from "@/features/wallet/lib/sign-wallet-entries";
import { explorerTxUrl } from "@/lib/stellar-explorer";

export const Route = createFileRoute("/_authenticated/wallet/send")({
  component: WalletSendScreen,
});

const ADDRESS_RE = /^[GC][A-Z2-7]{55}$/;

type Step = "enter" | "review" | "awaiting_guardian" | "done";

type SendErrorKey =
  | "wallet.send.errors.insufficient"
  | "wallet.send.errors.badRecipient"
  | "wallet.send.errors.delayed"
  | "wallet.send.errors.walletLocked"
  | "wallet.send.errors.network"
  | "wallet.send.errors.notSent";

function sendErrorKey(err: unknown): { key: SendErrorKey; shortfall?: string | undefined } {
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
  const [step, setStep] = useState<Step>("enter");
  const [rawAmount, setRawAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [review, setReview] = useState<SendReview | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const parsed = useParsedAmount(rawAmount);
  const recipientValid = ADDRESS_RE.test(recipient.trim());

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

  const confirmAndSign = useMutation({
    mutationFn: async (
      intentId: string,
    ): Promise<{ status: ConfirmResult["status"]; hash?: string }> => {
      const confirmed = await confirmSend(intentId);
      if (confirmed.status === "awaiting_guardian") return { status: "awaiting_guardian" };
      const signed = await signWalletEntries({
        entriesXdr: confirmed.authEntriesXdr,
        latestLedger: confirmed.latestLedger,
      });
      const settled = await signSend({ intentId, signedEntriesXdr: signed });
      return { status: "awaiting_signature", hash: settled.hash };
    },
    onSuccess: (r) => {
      if (r.status === "awaiting_guardian") {
        setStep("awaiting_guardian");
      } else {
        setTxHash(r.hash ?? null);
        setStep("done");
      }
    },
  });

  if (isLoading) return <Shell>{<LoadingRows />}</Shell>;
  if (isError) return <Shell>{<ErrorState />}</Shell>;
  if (!wallet) return <Shell>{<EmptyState message={t("wallet.send.noWallet")} />}</Shell>;

  if (step === "done") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-semibold text-2xl text-foreground">{t("wallet.send.done.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("wallet.send.done.description")}</p>
          {txHash ? (
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-muted-foreground text-xs underline"
            >
              {t("wallet.send.done.txLabel", { hash: `${txHash.slice(0, 8)}…` })}
            </a>
          ) : null}
        </div>
      </Shell>
    );
  }

  if (step === "awaiting_guardian") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-semibold text-2xl text-foreground">
            {t("wallet.send.guardian.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("wallet.send.guardian.description")}</p>
        </div>
      </Shell>
    );
  }

  if (step === "review" && review) {
    const err = confirmAndSign.isError ? sendErrorKey(confirmAndSign.error) : null;
    return (
      <Shell>
        <h1 className="font-semibold text-2xl text-foreground">{t("wallet.send.review.title")}</h1>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <Row label={t("wallet.send.review.amount")}>
              {formatAmount(review.amount, { locale: i18n.language, code: "XLM" })}
            </Row>
            <Row label={t("wallet.send.review.to")}>
              <span className="break-all font-mono text-sm">{review.recipient}</span>
            </Row>
            <p className="text-muted-foreground text-xs">{t("wallet.send.review.biometricNote")}</p>
            {err ? (
              <p className="text-destructive text-sm" role="alert">
                {t(err.key, { shortfall: err.shortfall ?? "" })}
              </p>
            ) : null}
            <Button
              disabled={confirmAndSign.isPending}
              onClick={() => confirmAndSign.mutate(review.intentId)}
            >
              {confirmAndSign.isPending
                ? t("wallet.send.review.signing")
                : t("wallet.send.review.cta")}
            </Button>
            <Button
              variant="ghost"
              disabled={confirmAndSign.isPending}
              onClick={() => setStep("enter")}
            >
              {t("wallet.send.review.backCta")}
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const err = prepare.isError ? sendErrorKey(prepare.error) : null;
  return (
    <Shell>
      <h1 className="font-semibold text-2xl text-foreground">{t("wallet.send.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("wallet.send.description")}</p>
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
            placeholder="G… / C…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={recipient.length > 0 && !recipientValid}
          />
          {recipient.length > 0 && !recipientValid ? (
            <span className="text-destructive text-xs">{t("wallet.send.errors.badRecipient")}</span>
          ) : null}
        </label>
        {err ? (
          <p className="text-destructive text-sm" role="alert">
            {t(err.key, { shortfall: err.shortfall ?? "" })}
          </p>
        ) : null}
        <Button type="submit" disabled={!parsed.ok || !recipientValid || prepare.isPending}>
          {prepare.isPending ? t("wallet.send.checking") : t("wallet.send.cta")}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      {children}
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}
