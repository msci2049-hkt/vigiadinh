// Màn "đã bỏ phiếu" — kết quả thật (tx hash) + giải thích bước kế: đủ phiếu
// thì còn CỬA SỔ CHỜ để chủ ví chặn, không phải xong ngay (đúng ngữ nghĩa timelock).
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
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
    <ProductScreen className="items-center justify-center text-center">
      <span className="grid size-20 place-items-center rounded-full bg-success text-paper">
        <Icon name="checkCircle" size={32} />
      </span>
      <ScreenHeader
        title={t("guardian.approved.title")}
        description={t("guardian.approved.description")}
        className="text-center"
      />
      <p className="product-copy">{t("guardian.approved.nextNote")}</p>
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
      <PrimaryZone className="w-full">
        <Button asChild>
          <Link to="/guardian">{t("guardian.approved.cta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
