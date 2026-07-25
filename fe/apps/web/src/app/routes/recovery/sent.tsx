// Bước 2: "đã gửi lời nhắn" — hiện MÃ CHÌA KHOÁ MỚI thật to để chủ ví đọc cho
// người thân qua điện thoại (đối chiếu ngoài băng — hàng rào chống tráo khoá,
// cùng mã mà guardian thấy trong app của họ trước khi mở khôi phục).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { DEMO_GUARDIANS, GuardianAvatarCluster } from "@/components/family/guardian-avatar-cluster";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { loadRecoveryDraft } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/sent")({
  validateSearch: z.object({ address: z.string().catch("") }),
  component: RecoverySentScreen,
});

function RecoverySentScreen() {
  const { t } = useTranslation("fw");
  const { address } = Route.useSearch();
  const draft = loadRecoveryDraft();

  return (
    <ProductScreen>
      <div className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
        <Icon name="checkCircle" size={32} />
      </div>
      <ScreenHeader title={t("recovery.sent.title")} description={t("recovery.sent.description")} />
      <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm">
        <GuardianAvatarCluster people={DEMO_GUARDIANS} />
        <p className="text-muted-foreground text-sm">{t("recovery.sent.notified")}</p>
      </div>
      {draft ? (
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.06em]">
            {t("recovery.sent.fingerprintLabel")}
          </p>
          <p className="break-all rounded-md bg-muted p-4 font-mono text-foreground text-sm">
            {draft.fingerprint}
          </p>
        </div>
      ) : null}
      <ErrorBanner type="info" title={t("recovery.sent.ownerNoticeTitle")}>
        {t("recovery.sent.readNote")}
      </ErrorBanner>
      <PrimaryZone>
        <Button asChild className="w-full">
          <Link to="/recovery/progress" search={{ address: address || draft?.address || "" }}>
            {t("recovery.sent.progressCta")}
          </Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
