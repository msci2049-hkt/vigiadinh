// Màn guardian MỞ khôi phục (PHA 6 cụm GHI) — từ "tiếng gõ cửa" của thiết bị
// mới. Ba hàng rào trước khi chữ ký rời máy:
//   1. Xác minh NGOÀI BĂNG: gọi cho chủ ví, đọc mã chìa khoá cho nhau nghe.
//   2. Chống-ký-mù TỰ ĐỘNG (audit P0): sau khi BE build entry, decode và so
//      fingerprint Signer TRONG ENTRY với mã đã hiện — BE bị chiếm mà tráo
//      khoá là hai phía lệch nhau → DỪNG, không ký.
//   3. Cổng sinh trắc học = chính prompt passkey.
import { ApiError } from "@repo/core";
import { Button, Card, CardContent } from "@repo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
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
import {
  RecoverySignError,
  signRecoveryEntries,
} from "@/features/wallet/lib/sign-recovery-entries";

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

type InitiateErrorKey =
  | "guardian.initiate.errors.mismatch"
  | "guardian.initiate.errors.alreadyOpen"
  | "guardian.initiate.errors.deviceKeyMissing"
  | "guardian.initiate.errors.notSent";

function apiErrorCode(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const data = err.data as { error?: { code?: string } } | null;
  return data?.error?.code ?? null;
}

function initiateErrorKey(err: unknown): InitiateErrorKey {
  if (err instanceof SignerMismatchError) return "guardian.initiate.errors.mismatch";
  if (err instanceof RecoverySignError) return "guardian.initiate.errors.deviceKeyMissing";
  if (apiErrorCode(err) === "CONTRACT_ERROR:RecoveryInProgress") {
    return "guardian.initiate.errors.alreadyOpen";
  }
  return "guardian.initiate.errors.notSent";
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

  const initiate = useMutation({
    mutationFn: initiateFlow,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: guardianInboxKeys.all });
      await queryClient.invalidateQueries({ queryKey: guardianInboxKeys.deviceRequests });
      await navigate({ to: "/guardian/approved", search: { tx: result.hash } });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("guardian.initiate.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("guardian.initiate.description")}</p>

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
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <p className="break-all font-mono text-muted-foreground text-xs">
              {t("guardian.initiate.fingerprintLabel", {
                fingerprint: item.deviceRequest.fingerprint,
              })}
            </p>
            <p className="text-foreground text-sm">{t("guardian.initiate.verifyNote")}</p>
            <p className="text-muted-foreground text-xs">{t("guardian.initiate.biometricNote")}</p>

            {initiate.isError ? (
              <p className="text-destructive text-sm" role="alert">
                {t(initiateErrorKey(initiate.error))}
              </p>
            ) : null}

            <Button disabled={initiate.isPending} onClick={() => initiate.mutate(item)}>
              {initiate.isPending ? t("guardian.initiate.signing") : t("guardian.initiate.cta")}
            </Button>
            <Button asChild variant="ghost" disabled={initiate.isPending}>
              <Link to="/guardian">{t("guardian.initiate.backCta")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
