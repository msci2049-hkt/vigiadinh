// Các màn kết cục của luồng gửi tiền (WP3 fe-smooth) — tách khỏi send.tsx để
// route chính dưới trần 300 dòng. Tiền tố `-` = TanStack Router bỏ qua file
// này khi sinh route tree (co-located, không phải route).

import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ProductImage } from "@/components/family/product-image";
import { DetailRow, PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { explorerTxUrl } from "@/lib/stellar-explorer";

export function Shell({ children }: { children: React.ReactNode }) {
  return <ProductScreen className="justify-center">{children}</ProductScreen>;
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <DetailRow label={label}>{children}</DetailRow>;
}

export function SendDoneScreen({ txHash }: { txHash: string | null }) {
  const { t } = useTranslation("fw");
  return (
    <Shell>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-success text-paper">
          <Icon name="checkCircle" size={32} />
        </span>
        <ScreenHeader
          title={t("wallet.send.done.title")}
          description={t("wallet.send.done.description")}
          className="text-center"
        />
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

export function SendGuardianWaitScreen() {
  const { t } = useTranslation("fw");
  return (
    <Shell>
      <div className="flex flex-col items-center gap-4 text-center">
        <ProductImage
          src="/assets/mascot/mascot-wait.png"
          webpSrc="/assets/mascot/mascot-wait.webp"
          avifSrc="/assets/mascot/mascot-wait.avif"
          alt=""
          width={640}
          height={640}
          className="h-44 w-44 object-contain"
        />
        <ScreenHeader
          title={t("wallet.send.guardian.title")}
          description={t("wallet.send.guardian.description")}
          className="text-center"
        />
      </div>
    </Shell>
  );
}

/**
 * Mạng đứt SAU khi nộp — tiền có thể đã đi. KHÔNG có nút gửi lại ở đây, theo
 * thiết kế: gửi lại lúc này là đường mất tiền hai lần (QA mục 8).
 */
export function SendUnconfirmedScreen({ pollExhausted }: { pollExhausted: boolean }) {
  const { t } = useTranslation("fw");
  return (
    <Shell>
      <div className="flex flex-col gap-5" role="alert">
        <ScreenHeader title={t("wallet.send.unconfirmed.title")} />
        <ErrorBanner type="warn" title={t("wallet.send.unconfirmed.title")}>
          {t("wallet.send.unconfirmed.body")}
        </ErrorBanner>
        {pollExhausted ? (
          <>
            <p className="product-copy">{t("wallet.send.unconfirmed.stillUnknown")}</p>
            <PrimaryZone>
              <Button asChild>
                <Link to="/wallet/history">{t("wallet.send.unconfirmed.historyCta")}</Link>
              </Button>
            </PrimaryZone>
          </>
        ) : (
          <ErrorBanner type="pending" title={t("wallet.send.unconfirmed.checking")} />
        )}
      </div>
    </Shell>
  );
}
