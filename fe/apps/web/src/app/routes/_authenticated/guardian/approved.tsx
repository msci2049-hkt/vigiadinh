// Màn "đã bỏ phiếu" — kết quả thật (tx hash) + giải thích bước kế: đủ phiếu
// thì còn CỬA SỔ CHỜ để chủ ví chặn, không phải xong ngay (đúng ngữ nghĩa timelock).
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { explorerTxUrl } from "@/lib/stellar-explorer";

export const Route = createFileRoute("/_authenticated/guardian/approved")({
  validateSearch: z.object({
    tx: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional()
      .catch(undefined),
  }),
  component: GuardianApprovedScreen,
});

function GuardianApprovedScreen() {
  const { t } = useTranslation("fw");
  const { tx } = Route.useSearch();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("guardian.approved.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("guardian.approved.description")}</p>
      <p className="text-muted-foreground text-sm">{t("guardian.approved.nextNote")}</p>
      {tx ? (
        <a
          href={explorerTxUrl(tx)}
          target="_blank"
          rel="noreferrer"
          className="break-all font-mono text-muted-foreground text-xs underline"
        >
          {t("guardian.approved.txLabel", { hash: `${tx.slice(0, 8)}…` })}
        </a>
      ) : null}
      <Button asChild className="mt-2 w-full">
        <Link to="/guardian">{t("guardian.approved.cta")}</Link>
      </Button>
    </main>
  );
}
