// Màn thừa kế (PHA 6 — cụm ĐỌC): danh sách người nhận + phần chia (%).
// bps 0..10000 → hiện % bằng Intl percent, locale tường minh (PHA 7.1 — cấm
// format tự chế). Sửa danh sách là việc cụm GHI (ký on-chain) — chưa mở ở đây.
import { Button, Card, CardContent } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { heirsOptions } from "@/features/family/api/inheritance";
import { EmptyState, ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { useActiveWallet } from "@/features/family/hooks/use-active-wallet";

export const Route = createFileRoute("/_authenticated/inheritance/")({
  component: InheritanceSetupScreen,
});

function formatShare(bps: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(bps / 10000);
}

function shortRef(ref: string): string {
  return ref.length > 12 ? `${ref.slice(0, 4)}…${ref.slice(-4)}` : ref;
}

function InheritanceSetupScreen() {
  const { t, i18n } = useTranslation("fw");
  const { wallet, isLoading: walletLoading, isError: walletError } = useActiveWallet();
  const heirs = useQuery({
    ...heirsOptions(wallet?.id ?? ""),
    enabled: wallet !== null,
  });

  return (
    <ProductScreen>
      <img
        src="/assets/people/banker-seated.png"
        alt=""
        className="mx-auto h-48 w-full max-w-xs object-contain"
      />
      <ScreenHeader
        title={t("inheritance.setup.title")}
        description={t("inheritance.setup.description")}
      />

      {walletLoading || heirs.isLoading ? <LoadingRows /> : null}
      {walletError || heirs.isError ? <ErrorState /> : null}
      {!walletLoading && !walletError && wallet === null ? (
        <EmptyState message={t("inheritance.noWallet")} />
      ) : null}
      {heirs.isSuccess && heirs.data.length === 0 ? (
        <EmptyState message={t("inheritance.empty")} />
      ) : null}

      <ul className="flex flex-col gap-2">
        {(heirs.data ?? []).map((heir, index) => (
          <li key={heir.id}>
            <Card className="bg-paper-2">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={`/assets/avatars/${index % 2 === 0 ? "sister" : "brother"}-104.webp`}
                    alt=""
                    className="size-12 rounded-full object-cover"
                  />
                  <span className="font-mono text-foreground text-sm">
                    {shortRef(heir.heirRef)}
                  </span>
                </div>
                <span className="font-mono font-semibold text-foreground text-lg">
                  {formatShare(heir.bps, i18n.language)}
                </span>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {wallet !== null ? (
        <PrimaryZone>
          <Button asChild>
            <Link to="/inheritance/heartbeat">
              <Icon name="heart" />
              {t("inheritance.heartbeatCta")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/inheritance/claim">{t("inheritance.claim.title")}</Link>
          </Button>
        </PrimaryZone>
      ) : null}
    </ProductScreen>
  );
}
