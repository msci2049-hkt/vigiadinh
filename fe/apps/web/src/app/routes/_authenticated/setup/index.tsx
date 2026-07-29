// Tạo ví (PHA 6 setup — mức A: ví một người ký, thêm guardian sau). Cổng sinh
// trắc học = prompt passkey khi kit.createWallet. Wizard đầy đủ (chọn guardian
// + threshold + timelock, cần trao đổi khoá đa bên) là bước SAU — các màn
// setup/* khác giữ nhãn đúng, dựng khi có luồng mời guardian.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ProductImage } from "@/components/family/product-image";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { walletKeys } from "@/features/family/api/wallets";
import { createWalletMinimal } from "@/features/wallet/api/create-wallet";
import { WalletNotConfiguredError } from "@/features/wallet/lib/kit";

export const Route = createFileRoute("/_authenticated/setup/")({ component: SetupIntroScreen });

function SetupIntroScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Email đi vào TÊN passkey — không có nó thì mọi khoá trong trình quản lý mật
  // khẩu đều tên giống hệt nhau và không ai phân biệt nổi (xem create-wallet.ts).
  const { user } = useCurrentUser();

  const create = useMutation({
    mutationFn: () => createWalletMinimal({ ownerLabel: user?.email }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: walletKeys.all });
      await navigate({ to: "/setup/done" });
    },
  });

  return (
    <ProductScreen className="justify-center">
      <ProductImage
        src="/assets/people/banker-present-right.png"
        webpSrc="/assets/people/banker-present-right.webp"
        avifSrc="/assets/people/banker-present-right.avif"
        alt=""
        width={960}
        height={1280}
        priority
        className="mx-auto h-52 w-full max-w-xs object-contain object-bottom"
      />
      <ScreenHeader
        title={t("setup.intro.title")}
        description={t("setup.intro.description")}
        display
      />
      <div className="grid gap-3">
        {(["setup.intro.point1", "setup.intro.point2", "setup.intro.point3"] as const).map(
          (pointKey) => (
            <div key={pointKey} className="flex items-center gap-3 rounded-card border bg-card p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary">
                <Icon name="checkCircle" />
              </span>
              <p className="text-copy">{t(pointKey)}</p>
            </div>
          ),
        )}
      </div>

      {create.isError ? (
        <ErrorBanner type="error" title={t("setup.intro.title")}>
          {create.error instanceof WalletNotConfiguredError
            ? t("setup.intro.errors.notConfigured")
            : t("setup.intro.errors.failed")}
        </ErrorBanner>
      ) : null}

      <PrimaryZone>
        <Button loading={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? t("setup.intro.creating") : t("setup.intro.cta")}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/passkey">{t("setup.intro.haveWalletCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
