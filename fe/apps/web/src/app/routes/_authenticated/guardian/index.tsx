// Hộp thư guardian (PHA 6 cụm GHI) — các yêu cầu khôi phục ĐANG MỞ trên ví
// mình bảo hộ. Mỗi thẻ → màn bỏ phiếu (/guardian/approve?wallet=…).
import { formatDateTime } from "@repo/core";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  guardianDeviceRequestsOptions,
  guardianInboxOptions,
} from "@/features/family/api/guardian-inbox";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";

export const Route = createFileRoute("/_authenticated/guardian/")({
  component: GuardianInboxScreen,
});

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function GuardianInboxScreen() {
  const { t, i18n } = useTranslation("fw");
  const inbox = useQuery(guardianInboxOptions);
  const knocks = useQuery(guardianDeviceRequestsOptions);
  // Ví đã có yêu cầu MỞ thì thẻ bỏ-phiếu đứng trên; "tiếng gõ cửa" chỉ hiện
  // cho ví CHƯA mở (mở chồng là contract chặn RecoveryInProgress).
  const openWalletIds = new Set((inbox.data ?? []).map((i) => i.wallet.id));
  const pendingKnocks = (knocks.data ?? []).filter((k) => !openWalletIds.has(k.wallet.id));

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("guardian.inbox.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("guardian.inbox.description")}</p>

      {inbox.isLoading || knocks.isLoading ? <LoadingRows /> : null}
      {inbox.isError || knocks.isError ? <ErrorState /> : null}
      {inbox.data && inbox.data.length === 0 && knocks.data && pendingKnocks.length === 0 ? (
        <EmptyState message={t("guardian.inbox.empty")} />
      ) : null}

      {pendingKnocks.map((k) => (
        <Card key={k.deviceRequest.id} className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">{t("guardian.inbox.knockTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-foreground text-sm">
              {t("guardian.inbox.knockBody", {
                address: shortAddress(k.wallet.stellarAddress),
              })}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("guardian.inbox.since", {
                when: formatDateTime(k.deviceRequest.createdAt, { locale: i18n.language }),
              })}
            </p>
            <Button asChild>
              <Link to="/guardian/initiate" search={{ wallet: k.wallet.id }}>
                {t("guardian.inbox.knockCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}

      {(inbox.data ?? []).map((item) => (
        <Card key={item.request.id}>
          <CardHeader>
            <CardTitle className="text-lg">
              {t("guardian.inbox.walletLabel", {
                address: shortAddress(item.wallet.stellarAddress),
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-foreground text-sm">
              {t("guardian.inbox.votes", {
                approvals: item.request.approvals,
                threshold: item.request.threshold ?? item.wallet.threshold,
              })}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("guardian.inbox.since", {
                when: formatDateTime(item.request.startedAt, { locale: i18n.language }),
              })}
            </p>
            <Button asChild>
              <Link to="/guardian/approve" search={{ wallet: item.wallet.id }}>
                {t("guardian.inbox.reviewCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
