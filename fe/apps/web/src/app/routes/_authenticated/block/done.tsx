// Màn "đã chặn xong" (PHA 6 cụm GHI) — kết quả THẬT: tx hash on-chain qua
// search param (validateSearch Zod). Người thân được báo tự động (indexer
// bắt event `cancel` → notify priority 0 — PHA 5.2).

import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
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
    <ProductScreen className="items-center justify-center text-center">
      <span className="grid size-20 place-items-center rounded-full bg-success text-paper">
        <Icon name="shieldCheck" size={32} />
      </span>
      <ScreenHeader
        title={t("block.done.title")}
        description={t("block.done.description")}
        className="text-center"
      />
      <p className="product-copy">{t("block.done.guardiansNote")}</p>
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
      <PrimaryZone className="w-full">
        <Button asChild>
          <Link to="/night-watch">{t("block.done.cta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
