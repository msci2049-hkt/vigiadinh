// Hộp thư guardian (PHA 6 cụm GHI) — các yêu cầu khôi phục ĐANG MỞ trên ví
// mình bảo hộ. Mỗi thẻ → màn bỏ phiếu (/guardian/approve?wallet=…).
import { formatDateTime } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { GuardianPortrait, guardianPortraitForIndex } from "@/components/family/guardian-portrait";
import { Icon } from "@/components/family/icons";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
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
    <ProductScreen>
      <ScreenHeader
        title={t("guardian.inbox.title")}
        description={t("guardian.inbox.description")}
      />

      {inbox.isLoading || knocks.isLoading ? <LoadingRows /> : null}
      {inbox.isError || knocks.isError ? <ErrorState /> : null}
      {inbox.data && inbox.data.length === 0 && knocks.data && pendingKnocks.length === 0 ? (
        <EmptyState message={t("guardian.inbox.empty")} />
      ) : null}

      {pendingKnocks.map((k) => (
        <Card key={k.deviceRequest.id} className="border-primary bg-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <span className="grid size-10 place-items-center rounded-full bg-primary">
                <Icon name="userPlus" />
              </span>
              {t("guardian.inbox.knockTitle")}
            </CardTitle>
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
            <Button asChild variant="secondary">
              <Link to="/guardian/initiate" search={{ wallet: k.wallet.id }}>
                {t("guardian.inbox.knockCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}

      {(inbox.data ?? []).map((item, index) => (
        <Card key={item.request.id} className="bg-paper-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <GuardianPortrait
                variant={guardianPortraitForIndex(index)}
                className="size-12 rounded-full"
              />
              <span>
                {t("guardian.inbox.walletLabel", {
                  address: shortAddress(item.wallet.stellarAddress),
                })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-foreground text-sm">
              {t("guardian.inbox.votes", {
                approvals: item.request.approvals,
                threshold: item.request.threshold ?? item.wallet.threshold,
              })}
            </p>
            {/* R6 — hai trạng thái mà việc của người bảo hộ ĐÃ XONG: họ đã ký, hoặc
                đã đủ phiếu. Cả hai đều KHÔNG được mời bấm ký nữa: nút đó dẫn thẳng
                tới `AlreadyApproved` sau khi đã bắt họ chạm vân tay. */}
            {item.viewerApproved ? (
              <p className="font-semibold text-success text-sm" data-testid="inbox-you-approved">
                {t("guardian.inbox.youApproved")}
              </p>
            ) : null}
            {item.request.status === "ready" ? (
              <p className="font-semibold text-foreground text-sm" data-testid="inbox-ready">
                {t("guardian.inbox.thresholdMet")}
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {t("guardian.inbox.since", {
                when: formatDateTime(item.request.startedAt, { locale: i18n.language }),
              })}
            </p>
            {/* Qua màn cảnh báo theo quy tắc TRƯỚC (speed-bump chống social-engineering). */}
            <Button asChild variant={item.viewerApproved ? "outline" : "secondary"}>
              <Link
                to={item.viewerApproved ? "/guardian/approve" : "/guardian/approve-warning"}
                search={{ wallet: item.wallet.id }}
              >
                {t(item.viewerApproved ? "guardian.inbox.progressCta" : "guardian.inbox.reviewCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </ProductScreen>
  );
}
