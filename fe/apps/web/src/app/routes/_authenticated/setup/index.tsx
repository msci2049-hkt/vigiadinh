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

type CreateErrorKey =
  | "setup.intro.errors.notConfigured"
  | "setup.intro.errors.deviceDeclined"
  | "setup.intro.errors.failed";

/**
 * Mỗi nguyên nhân một câu (sự cố 30/07): câu cũ "Thiết bị chưa xác nhận" từng
 * che MỌI lỗi — kể cả TypeError user.id tràn 64 byte, lúc thiết bị chưa hề
 * được hỏi — và làm mất một giờ điều tra. "Thiết bị chưa xác nhận" giờ CHỈ
 * dành cho đúng ca đó (NotAllowedError: người dùng bấm huỷ / máy từ chối).
 */
function createErrorKey(err: unknown): CreateErrorKey {
  if (err instanceof WalletNotConfiguredError) return "setup.intro.errors.notConfigured";
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "setup.intro.errors.deviceDeclined";
  }
  return "setup.intro.errors.failed";
}

/** Mã kỹ thuật cho đội hỗ trợ — không bao giờ nuốt lỗi gốc nữa. */
function createErrorCode(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 140);
  return String(err).slice(0, 140);
}

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
        src="/assets/characters/european-family-hero.png"
        webpSrc="/assets/characters/european-family-hero.webp"
        alt=""
        width={1122}
        height={1402}
        priority
        className="family-scene family-scene--compact"
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
          <p>{t(createErrorKey(create.error))}</p>
          {create.error instanceof WalletNotConfiguredError ? null : (
            <p className="mt-1 text-xs opacity-70" data-testid="setup-create-error-code">
              {t("setup.intro.errors.technical", { code: createErrorCode(create.error) })}
            </p>
          )}
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
