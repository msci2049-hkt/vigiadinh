// C7 — "Ví tôi đang gác": chiều NGƯỢC của /guardians. Người bảo hộ thấy các
// ví mình đang gác; ví có yêu cầu khôi phục ĐANG MỞ nổi lên đầu với nhãn cảnh
// báo dẫn thẳng vào màn duyệt sẵn có (C8). Mở màn = một chạm "tôi còn đây"
// (ack presence) — nguồn last_seen_at THẬT cho phía chủ ví, không bịa số.
//
// Lô R1 — hai bổ sung, cùng một câu chuyện "chủ ví mất máy":
//   1. Khối "Yêu cầu đang chờ" ở ĐẦU màn. Trước đó màn này chỉ query
//      protecting/inbox/approvals, nên "tiếng gõ cửa" của thiết bị mới không
//      hiện ở đâu trong app — và /guardian thì không nằm trong thanh tab.
//   2. Địa chỉ ví ĐỦ 56 ký tự + nút copy. Người mất máy không nhớ nổi 56 ký tự
//      base32 và app chưa có đường tra ví bằng email; gọi người thân đọc hộ là
//      đường thoát duy nhất, nên ở đây CẤM shortAddress.
import { formatAmount, formatDate, formatRelativeTime } from "@repo/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icons";
import { ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent } from "@/components/family/ui";
import {
  guardianDeviceRequestsOptions,
  guardianInboxOptions,
} from "@/features/family/api/guardian-inbox";
import { pendingApprovalsOptions } from "@/features/family/api/pending-approvals";
import { ackPresence, protectingOptions } from "@/features/family/api/protecting";
import { GuardianStatusBadge } from "@/features/family/components/guardian-status-badge";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { groupAddress } from "@/features/family/lib/address";

export const Route = createFileRoute("/_authenticated/protecting")({
  component: ProtectingScreen,
});

/** Địa chỉ ví ĐỦ + nút copy. Hiện chia nhóm 4 để đọc qua điện thoại; copy chép
 * bản GỐC (không khoảng trắng) để dán vào ô tìm ví là chạy ngay. */
function WalletAddressRow({ address }: { address: string }) {
  const { t } = useTranslation("fw");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-dashed bg-card p-3">
      <span className="text-muted-foreground text-xs">{t("protecting.item.addressLabel")}</span>
      <p className="break-all font-mono text-foreground text-xs leading-relaxed">
        {groupAddress(address)}
      </p>
      <Button variant="outline" size="sm" onClick={copy}>
        <Icon name={copied ? "checkCircle" : "copy"} size={20} />
        {copied ? t("protecting.item.copied") : t("protecting.item.copyCta")}
      </Button>
    </div>
  );
}

function ProtectingScreen() {
  const { t, i18n } = useTranslation("fw");
  const protecting = useQuery(protectingOptions);
  const inbox = useQuery(guardianInboxOptions);
  // LÔ 1 A5 — phiếu duyệt CHUYỂN TIỀN đang chờ chính user này. Nổi LÊN ĐẦU màn:
  // đây là việc có hạn chót, không phải thông tin nền.
  const approvals = useQuery(pendingApprovalsOptions);
  // Lô R1 — "tiếng gõ cửa" của thiết bị mới trên ví mình gác.
  const knocks = useQuery(guardianDeviceRequestsOptions);

  useEffect(() => {
    void ackPresence().catch(() => {});
  }, []);

  const openWalletIds = new Set((inbox.data ?? []).map((item) => item.wallet.id));
  // Ví ĐÃ có khôi phục mở thì thẻ bỏ-phiếu là việc đúng, không phải knock nữa
  // (mở chồng là contract chặn RecoveryInProgress) — cùng luật lọc với /guardian.
  const pendingKnocks = (knocks.data ?? []).filter((k) => !openWalletIds.has(k.wallet.id));
  const items = [...(protecting.data ?? [])].sort(
    (a, b) => Number(openWalletIds.has(b.wallet_id)) - Number(openWalletIds.has(a.wallet_id)),
  );

  return (
    <ProductScreen>
      <ScreenHeader title={t("protecting.title")} description={t("protecting.description")} />

      {pendingKnocks.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label={t("protecting.knocks.title")}>
          <h2 className="font-semibold text-destructive text-sm">{t("protecting.knocks.title")}</h2>
          <ul className="flex flex-col gap-3">
            {pendingKnocks.map((k) => (
              <li key={k.deviceRequest.id}>
                <Card className="border-primary bg-accent">
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary">
                        <Icon name="userPlus" />
                      </span>
                      <p className="font-semibold text-foreground text-sm">
                        {t("protecting.knocks.item")}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t("protecting.knocks.since", {
                        when: formatRelativeTime(k.deviceRequest.createdAt, {
                          locale: i18n.language,
                        }),
                      })}
                    </p>
                    <Button asChild size="sm">
                      <Link to="/guardian/initiate" search={{ wallet: k.wallet.id }}>
                        {t("protecting.knocks.reviewCta")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(approvals.data ?? []).length > 0 ? (
        <section className="flex flex-col gap-3" aria-label={t("protecting.approvals.title")}>
          <h2 className="font-semibold text-destructive text-sm">
            {t("protecting.approvals.title")}
          </h2>
          <ul className="flex flex-col gap-3">
            {(approvals.data ?? []).map((a) => {
              const owner = a.owner_name?.trim() ? a.owner_name : t("protecting.item.unnamed");
              return (
                <li key={a.approval_id}>
                  <Card className="border-primary bg-accent">
                    <CardContent className="flex flex-col gap-3 p-4">
                      <p className="font-semibold text-foreground text-sm">
                        {t("protecting.approvals.item", {
                          name: owner,
                          amount: a.amount
                            ? formatAmount(a.amount, { locale: i18n.language, code: "XLM" })
                            : "—",
                          recipient: a.recipient_short,
                        })}
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground text-xs">
                          {t("protecting.approvals.expires", {
                            when: formatRelativeTime(a.expires_at, { locale: i18n.language }),
                          })}
                        </span>
                        <Button asChild size="sm">
                          <Link to="/guardian/approve-intent" search={{ intent: a.intent_id }}>
                            {t("protecting.approvals.reviewCta")}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {protecting.isLoading ? <LoadingRows /> : null}
      {protecting.isError ? <ErrorState /> : null}
      {protecting.isSuccess && items.length === 0 ? (
        <EmptyState message={t("protecting.empty")} />
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const hasOpenRecovery = openWalletIds.has(item.wallet_id);
          const name = item.owner_name?.trim() ? item.owner_name : t("protecting.item.unnamed");
          return (
            <li key={item.id}>
              <Card className={hasOpenRecovery ? "border-primary bg-accent" : "bg-paper-2"}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-semibold text-foreground text-sm">
                      {t("protecting.item.title", { name })}
                    </span>
                    <GuardianStatusBadge status={item.status} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t("protecting.item.since", {
                      date: formatDate(item.protecting_since, { locale: i18n.language }),
                    })}
                    {" · "}
                    {item.last_seen_at
                      ? t("protecting.item.activity", {
                          when: formatRelativeTime(item.last_seen_at, { locale: i18n.language }),
                        })
                      : t("protecting.item.noActivity")}
                  </p>
                  <WalletAddressRow address={item.stellar_address} />
                  {hasOpenRecovery ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-destructive text-sm">
                        {t("protecting.item.recoveryOpen")}
                      </span>
                      <Button asChild size="sm">
                        <Link to="/guardian/approve-warning" search={{ wallet: item.wallet_id }}>
                          {t("protecting.item.reviewCta")}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </ProductScreen>
  );
}
