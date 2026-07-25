// Cổng khôi phục (PUBLIC — người mất máy chưa có session, chủ ý). Giải thích
// 3 bước bằng chữ người thường rồi dẫn vào find-wallet; ai đã gửi rồi thì
// nhảy thẳng sang tiến độ (draft còn trong localStorage).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { type FamilyIconName, Icon } from "@/components/family/icon";
import { IconDisc, PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { loadRecoveryDraft } from "@/features/wallet/api/device-recovery";

export const Route = createFileRoute("/recovery/")({ component: RecoveryStartScreen });

function RecoveryStartScreen() {
  const { t } = useTranslation("fw");
  const draft = loadRecoveryDraft();
  const steps: { icon: FamilyIconName; copy: string }[] = [
    { icon: "fingerprint", copy: t("recovery.start.step1") },
    { icon: "users", copy: t("recovery.start.step2") },
    { icon: "shieldCheck", copy: t("recovery.start.step3") },
  ];

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("recovery.start.title")}
        description={t("recovery.start.description")}
      />
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.icon}
            className="flex items-center gap-4 rounded-md border bg-card p-4 shadow-sm"
          >
            <IconDisc>
              <Icon name={step.icon} size={20} />
            </IconDisc>
            <span className="text-sm leading-relaxed">
              <span className="mr-2 font-mono text-muted-foreground">{index + 1}</span>
              {step.copy}
            </span>
          </li>
        ))}
      </ol>
      <PrimaryZone>
        <Button asChild>
          <Link to="/recovery/find-wallet">{t("recovery.start.cta")}</Link>
        </Button>
        {draft ? (
          <Button asChild variant="secondary">
            <Link to="/recovery/progress" search={{ address: draft.address }}>
              {t("recovery.start.progressCta")}
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="link">
          <Link to="/passkey">{t("recovery.start.signInCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
