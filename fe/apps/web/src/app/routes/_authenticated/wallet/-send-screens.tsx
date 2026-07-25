// Các màn kết cục của luồng gửi tiền (WP3 fe-smooth) — tách khỏi send.tsx để
// route chính dưới trần 300 dòng. Tiền tố `-` = TanStack Router bỏ qua file
// này khi sinh route tree (co-located, không phải route).
import { Button } from "@repo/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { explorerTxUrl } from "@/lib/stellar-explorer";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      {children}
    </main>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export function SendDoneScreen({ txHash }: { txHash: string | null }) {
  const { t } = useTranslation("fw");
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

export function SendGuardianWaitScreen() {
  const { t } = useTranslation("fw");
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

/**
 * Mạng đứt SAU khi nộp — tiền có thể đã đi. KHÔNG có nút gửi lại ở đây, theo
 * thiết kế: gửi lại lúc này là đường mất tiền hai lần (QA mục 8).
 */
export function SendUnconfirmedScreen({ pollExhausted }: { pollExhausted: boolean }) {
  const { t } = useTranslation("fw");
  return (
    <Shell>
      <div className="flex flex-col gap-4" role="alert">
        <h1 className="font-semibold text-2xl text-foreground">
          {t("wallet.send.unconfirmed.title")}
        </h1>
        <p className="text-foreground text-sm">{t("wallet.send.unconfirmed.body")}</p>
        {pollExhausted ? (
          <>
            <p className="text-muted-foreground text-sm">
              {t("wallet.send.unconfirmed.stillUnknown")}
            </p>
            <Button asChild variant="outline">
              <Link to="/wallet/history">{t("wallet.send.unconfirmed.historyCta")}</Link>
            </Button>
          </>
        ) : (
          <p className="animate-pulse text-muted-foreground text-sm" data-testid="send-checking">
            {t("wallet.send.unconfirmed.checking")}
          </p>
        )}
      </div>
    </Shell>
  );
}
