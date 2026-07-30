// Màn DUYỆT LỆNH CHUYỂN TIỀN của guardian (LÔ 1 A5 — call-site đầu tiên của
// POST /api/intents/send/guardian-approve). Khác màn duyệt RECOVERY bên cạnh
// (approve.tsx — phiếu ký on-chain bằng passkey): phiếu ở đây là bản ghi
// off-chain, không prompt passkey. Nợ S1 (guardian không ký gì) đã ghi ở
// docs/AUDIT-TINH-NANG-2026-07-29.md — xử ở lô sau, KHÔNG xử ở đây.
import { ApiError, formatAmount, formatDate } from "@repo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";
import {
  decideIntentApproval,
  pendingApprovalsKeys,
  pendingApprovalsOptions,
} from "@/features/family/api/pending-approvals";
import { IntentSignalsCard } from "@/features/family/components/intent-signals-card";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";

export const Route = createFileRoute("/_authenticated/guardian/approve-intent")({
  validateSearch: z.object({ intent: z.string().catch("") }),
  component: ApproveIntentScreen,
});

// reason code policy → key i18n chuỗi người thường. Ngoài map → generic.
const REASON_KEYS = {
  unknown_recipient: "guardian.approveIntent.reasons.unknownRecipient",
  over_tx_limit: "guardian.approveIntent.reasons.overTxLimit",
  over_daily_limit: "guardian.approveIntent.reasons.overDailyLimit",
  blacklisted_recipient: "guardian.approveIntent.reasons.blacklisted",
} as const;

function reasonKey(
  reason: string,
): (typeof REASON_KEYS)[keyof typeof REASON_KEYS] | "guardian.approveIntent.reasons.other" {
  return reason in REASON_KEYS
    ? REASON_KEYS[reason as keyof typeof REASON_KEYS]
    : "guardian.approveIntent.reasons.other";
}

type DecideErrorKey =
  | "guardian.approveIntent.errors.alreadyDecided"
  | "guardian.approveIntent.errors.expired"
  | "guardian.approveIntent.errors.notSent";

function decideErrorKey(err: unknown): DecideErrorKey {
  if (err instanceof ApiError) {
    const data = err.data as { error?: { code?: string } } | null;
    const code = data?.error?.code ?? "";
    if (code === "ALREADY_DECIDED") return "guardian.approveIntent.errors.alreadyDecided";
    if (code.startsWith("INVALID_TRANSITION") || code === "APPROVAL_BINDING_MISMATCH") {
      return "guardian.approveIntent.errors.expired";
    }
  }
  return "guardian.approveIntent.errors.notSent";
}

function ApproveIntentScreen() {
  const { t, i18n } = useTranslation("fw");
  const { intent: intentId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [verifiedCall, setVerifiedCall] = useState(false);

  const approvals = useQuery(pendingApprovalsOptions);
  const item = (approvals.data ?? []).find((a) => a.intent_id === intentId);

  const decide = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      decideIntentApproval({ intentId, decision, verifiedCall }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pendingApprovalsKeys.all });
      await navigate({ to: "/protecting" });
    },
  });

  const ownerName = item?.owner_name?.trim()
    ? item.owner_name
    : t("guardian.approveIntent.unnamedOwner");

  return (
    <ProductScreen className="justify-center">
      <ScreenHeader
        title={t("guardian.approveIntent.title")}
        description={t("guardian.approveIntent.description")}
      />

      {approvals.isLoading ? <LoadingRows /> : null}
      {approvals.isError ? <ErrorState /> : null}
      {approvals.isSuccess && !item ? (
        <div className="flex flex-col gap-3">
          <EmptyState message={t("guardian.approveIntent.gone")} />
          <Button asChild variant="outline">
            <Link to="/protecting">{t("guardian.approveIntent.backCta")}</Link>
          </Button>
        </div>
      ) : null}

      {item ? (
        <Card className="bg-paper-2">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="border-b pb-5 text-center">
              <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.06em]">
                {t("guardian.approveIntent.amountLabel", { name: ownerName })}
              </p>
              <p className="product-money">
                {item.amount
                  ? formatAmount(item.amount, { locale: i18n.language, code: "XLM" })
                  : "—"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                {t("guardian.approveIntent.toLabel")}
              </span>
              <span className="font-mono text-sm">{item.recipient_short}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                {t("guardian.approveIntent.expiresLabel")}
              </span>
              <span className="text-sm">
                {formatDate(item.expires_at, { locale: i18n.language })}
              </span>
            </div>
            {item.reasons.length > 0 ? (
              <ul className="flex flex-col gap-1 rounded-card border border-dashed bg-card p-4">
                {item.reasons.map((reason) => (
                  <li key={reason} className="text-muted-foreground text-sm">
                    {t(reasonKey(reason))}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Lô R2 §5.4 — tín hiệu rủi ro hiện LUÔN ở màn guardian: người
                đang quyết là tiền của NGƯỜI KHÁC. Nằm trên nút duyệt, cạnh
                khối hướng dẫn gọi điện. */}
            <IntentSignalsCard intentId={item.intent_id} audience="guardian" />

            <ErrorBanner type="warn" title={t("guardian.approveIntent.verifyTitle")}>
              {t("guardian.approveIntent.verifyNote", { name: ownerName })}
            </ErrorBanner>

            <label className="flex min-h-12 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={verifiedCall}
                onChange={(e) => setVerifiedCall(e.target.checked)}
                className="mt-1 size-5 accent-primary"
              />
              <span className="text-sm">{t("guardian.approveIntent.verifiedCall")}</span>
            </label>

            {decide.isError ? (
              <ErrorBanner type="error" title={t(decideErrorKey(decide.error))} />
            ) : null}

            <PrimaryZone>
              <Button
                loading={decide.isPending && decide.variables === "approved"}
                disabled={!verifiedCall || decide.isPending}
                onClick={() => decide.mutate("approved")}
              >
                {t("guardian.approveIntent.approveCta")}
              </Button>
              <Button
                variant="outline"
                disabled={decide.isPending}
                loading={decide.isPending && decide.variables === "rejected"}
                onClick={() => decide.mutate("rejected")}
              >
                {t("guardian.approveIntent.rejectCta")}
              </Button>
              <Button asChild variant="ghost" disabled={decide.isPending}>
                <Link to="/protecting">{t("guardian.approveIntent.backCta")}</Link>
              </Button>
            </PrimaryZone>
          </CardContent>
        </Card>
      ) : null}
    </ProductScreen>
  );
}
