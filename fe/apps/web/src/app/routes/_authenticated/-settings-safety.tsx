// Cài đặt → An toàn (lô policy 2026-07-29, E1-E6 + D3) — tiền tố `-` = không
// phải route. Ở TẦNG APP vì phải compose HAI feature: family (API policy) +
// wallet (ký passkey) — feature không được import chéo nhau.
//
// Hai tầng hiển thị rõ ràng (E1):
// 1. TRẦN CỨNG on-chain — ghi trong hợp đồng, ngoài chủ ví không ai đổi được;
//    ví cũ chưa gắn → nút "Bật khoá chi tiêu" ký add_policy bằng passkey (D3).
// 2. NGƯỠNG MỀM tự cài — form per_tx/daily; nâng chờ 24h (banner đếm ngược +
//    nút huỷ), hạ áp ngay.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/family/error-banner";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/family/ui";
import {
  cancelPendingPolicy,
  onchainPolicyOptions,
  policyKeys,
  prepareEnableOnchainPolicy,
  putSpendingPolicy,
  spendingPolicyOptions,
  submitEnableOnchainPolicy,
} from "@/features/family/api/policy";
import type { FamilyWallet } from "@/features/family/api/wallets";
import { assertAddPolicyEntries } from "@/features/wallet/lib/policy-link";
import { signWalletEntries } from "@/features/wallet/lib/sign-wallet-entries";
import { env } from "@/lib/env";

const STROOPS_PER_XLM = 10_000_000n;

function stroopsToXlm(stroops: string): string {
  return (BigInt(stroops) / STROOPS_PER_XLM).toString();
}

/** XLM nguyên (chuỗi người dùng gõ) → stroops; null nếu không phải số nguyên dương. */
function xlmToStroops(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const xlm = BigInt(trimmed);
  if (xlm <= 0n) return null;
  return xlm * STROOPS_PER_XLM;
}

function explorerUrl(contractId: string): string {
  const net = env.VITE_STELLAR_NETWORK_PASSPHRASE.startsWith("Test ") ? "testnet" : "public";
  return `https://stellar.expert/explorer/${net}/contract/${contractId}`;
}

/** Tầng 1 — trần cứng on-chain + nút bật cho ví cũ (D3). */
function HardCapSection({ wallet }: { wallet: FamilyWallet }) {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const onchain = useQuery(onchainPolicyOptions(wallet.id));
  const policyId = env.VITE_SPENDING_LIMIT_POLICY;

  const enable = useMutation({
    mutationFn: async () => {
      const built = await prepareEnableOnchainPolicy(wallet.id);
      // Chống ký mù: entry phải là add_policy đúng cấu hình trên CHÍNH ví này.
      assertAddPolicyEntries(built.authEntriesXdr, wallet.stellarAddress);
      const signed = await signWalletEntries({
        entriesXdr: built.authEntriesXdr,
        latestLedger: built.latestLedger,
      });
      return submitEnableOnchainPolicy({ walletId: wallet.id, signedEntriesXdr: signed });
    },
    onSuccess: () => {
      toast(t("settings.safety.hard.enabled"));
      void queryClient.invalidateQueries({ queryKey: policyKeys.onchain(wallet.id) });
    },
  });

  if (!policyId) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-sm">{t("settings.safety.hard.title")}</p>
      <p className="text-muted-foreground text-sm">{t("settings.safety.body")}</p>
      <a
        href={explorerUrl(policyId)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-12 items-center break-all font-mono text-muted-foreground text-xs underline"
      >
        {policyId}
      </a>
      {onchain.data?.attached === true ? (
        <ErrorBanner type="pending" title={t("settings.safety.hard.attached")} />
      ) : null}
      {onchain.data?.attached === false ? (
        <div className="flex flex-col gap-2">
          <ErrorBanner type="warn" title={t("settings.safety.hard.notAttached")} />
          {enable.isError ? (
            <ErrorBanner type="error" title={t("settings.safety.hard.enableFailed")} />
          ) : null}
          <Button loading={enable.isPending} onClick={() => enable.mutate()}>
            {t("settings.safety.hard.enableCta")}
          </Button>
        </div>
      ) : null}
      {onchain.data?.attached === null ? (
        <p className="text-muted-foreground text-xs">{t("settings.safety.hard.unknown")}</p>
      ) : null}
    </div>
  );
}

/** Banner đề nghị nâng đang chờ (E4) — đếm ngược + huỷ (B5). */
function PendingBanner({
  walletId,
  pending,
}: {
  walletId: string;
  pending: { perTxLimit: string; dailyLimit: string; effectiveAt: string };
}) {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const remainingMs = Math.max(0, new Date(pending.effectiveAt).getTime() - now);
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);

  const cancel = useMutation({
    mutationFn: () => cancelPendingPolicy(walletId),
    onSuccess: () => {
      toast(t("settings.safety.pending.cancelled"));
      void queryClient.invalidateQueries({ queryKey: policyKeys.soft(walletId) });
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-card border border-dashed bg-card p-4">
      <ErrorBanner
        type="warn"
        title={t("settings.safety.pending.title", {
          perTx: stroopsToXlm(pending.perTxLimit),
          daily: stroopsToXlm(pending.dailyLimit),
        })}
      />
      <p className="text-muted-foreground text-sm">
        {t("settings.safety.pending.countdown", { hours, minutes })}
      </p>
      {cancel.isError ? (
        <ErrorBanner type="error" title={t("settings.safety.pending.cancelFailed")} />
      ) : null}
      <Button variant="destructive" loading={cancel.isPending} onClick={() => cancel.mutate()}>
        {t("settings.safety.pending.cancelCta")}
      </Button>
    </div>
  );
}

/** Thẻ An toàn đầy đủ — dùng ở màn Cài đặt. */
export function SettingsSafetyCard({ wallet }: { wallet: FamilyWallet }) {
  const { t } = useTranslation("fw");
  const queryClient = useQueryClient();
  const policy = useQuery(spendingPolicyOptions(wallet.id));
  const [perTx, setPerTx] = useState("");
  const [daily, setDaily] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: { perTxStroops: string; dailyStroops: string }) =>
      putSpendingPolicy({ walletId: wallet.id, ...input }),
    onSuccess: (result) => {
      // E3/E5 — nói rõ chuyện gì xảy ra: hạ áp ngay, nâng chờ 24h huỷ được.
      if (result.kind === "applied") toast(t("settings.safety.soft.applied"));
      else if (result.kind === "pending") toast(t("settings.safety.soft.pendingCreated"));
      else toast(t("settings.safety.soft.unchanged"));
      setPerTx("");
      setDaily("");
      void queryClient.invalidateQueries({ queryKey: policyKeys.soft(wallet.id) });
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);
    const perTxStroops = xlmToStroops(perTx);
    const dailyStroops = xlmToStroops(daily);
    if (perTxStroops === null || dailyStroops === null) {
      setFieldError(t("settings.safety.soft.errors.bad"));
      return;
    }
    // E2 — validate tại chỗ, cùng luật với BE (BE vẫn là nơi cưỡng chế).
    if (dailyStroops < perTxStroops) {
      setFieldError(t("settings.safety.soft.errors.daily"));
      return;
    }
    const cap = BigInt(policy.data?.onchainCapStroops ?? "200000000000");
    if (perTxStroops > cap || dailyStroops > cap) {
      setFieldError(
        t("settings.safety.soft.errors.cap", { cap: (cap / STROOPS_PER_XLM).toString() }),
      );
      return;
    }
    save.mutate({ perTxStroops: perTxStroops.toString(), dailyStroops: dailyStroops.toString() });
  };

  return (
    <Card className="bg-paper-2">
      <CardHeader>
        <CardTitle className="text-base">{t("settings.safety.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-copy">
        <HardCapSection wallet={wallet} />

        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="font-medium text-sm">{t("settings.safety.soft.title")}</p>
          <p className="text-muted-foreground text-sm">{t("settings.safety.soft.body")}</p>
          {policy.data ? (
            <p className="text-sm">
              {t("settings.safety.soft.current", {
                perTx: stroopsToXlm(policy.data.active.perTxLimit),
                daily: stroopsToXlm(policy.data.active.dailyLimit),
              })}
            </p>
          ) : null}
          {policy.data?.pending ? (
            <PendingBanner walletId={wallet.id} pending={policy.data.pending} />
          ) : null}
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <label htmlFor="policy-per-tx" className="flex flex-col gap-1">
              <span className="text-foreground text-sm">
                {t("settings.safety.soft.perTxLabel")}
              </span>
              <Input
                id="policy-per-tx"
                inputMode="numeric"
                value={perTx}
                onChange={(e) => setPerTx(e.target.value)}
              />
            </label>
            <label htmlFor="policy-daily" className="flex flex-col gap-1">
              <span className="text-foreground text-sm">
                {t("settings.safety.soft.dailyLabel")}
              </span>
              <Input
                id="policy-daily"
                inputMode="numeric"
                value={daily}
                onChange={(e) => setDaily(e.target.value)}
              />
            </label>
            <p className="text-muted-foreground text-xs">{t("settings.safety.soft.raiseNote")}</p>
            {fieldError ? <ErrorBanner type="error" title={fieldError} /> : null}
            {save.isError ? (
              <ErrorBanner type="error" title={t("settings.safety.soft.saveFailed")} />
            ) : null}
            <Button type="submit" loading={save.isPending} disabled={!perTx || !daily}>
              {t("settings.safety.soft.saveCta")}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
