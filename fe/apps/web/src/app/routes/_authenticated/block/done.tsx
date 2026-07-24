// Màn "đã chặn xong" (PHA 6 cụm GHI) — kết quả THẬT: tx hash on-chain qua
// search param (validateSearch Zod). Người thân được báo tự động (indexer
// bắt event `cancel` → notify priority 0 — PHA 5.2).
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { explorerTxUrl } from "@/lib/stellar-explorer";

export const Route = createFileRoute("/_authenticated/block/done")({
  // 64 hex = độ dài tx hash Stellar (hằng số mạng, không phải ngưỡng validate BE).
  validateSearch: z.object({
    tx: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional()
      .catch(undefined),
  }),
  component: BlockDoneScreen,
});

function BlockDoneScreen() {
  const { t } = useTranslation("fw");
  const { tx } = Route.useSearch();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-semibold text-2xl text-foreground">{t("block.done.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("block.done.description")}</p>
      <p className="text-muted-foreground text-sm">{t("block.done.guardiansNote")}</p>
      {tx ? (
        <a
          href={explorerTxUrl(tx)}
          target="_blank"
          rel="noreferrer"
          className="break-all font-mono text-muted-foreground text-xs underline"
        >
          {t("block.done.txLabel", { hash: `${tx.slice(0, 8)}…` })}
        </a>
      ) : null}
      <Button asChild className="mt-2 w-full">
        <Link to="/night-watch">{t("block.done.cta")}</Link>
      </Button>
    </main>
  );
}
