// Tạo ví (PHA 6 setup — mức A: ví một người ký, thêm guardian sau). Cổng sinh
// trắc học = prompt passkey khi kit.createWallet. Wizard đầy đủ (chọn guardian
// + threshold + timelock, cần trao đổi khoá đa bên) là bước SAU — các màn
// setup/* khác giữ nhãn đúng, dựng khi có luồng mời guardian.
import { Button } from "@repo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { walletKeys } from "@/features/family/api/wallets";
import { createWalletMinimal } from "@/features/wallet/api/create-wallet";
import { WalletNotConfiguredError } from "@/features/wallet/lib/kit";

export const Route = createFileRoute("/_authenticated/setup/")({ component: SetupIntroScreen });

function SetupIntroScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: createWalletMinimal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: walletKeys.all });
      await navigate({ to: "/setup/done" });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("setup.intro.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("setup.intro.description")}</p>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
        <li>{t("setup.intro.point1")}</li>
        <li>{t("setup.intro.point2")}</li>
        <li>{t("setup.intro.point3")}</li>
      </ul>

      {create.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {create.error instanceof WalletNotConfiguredError
            ? t("setup.intro.errors.notConfigured")
            : t("setup.intro.errors.failed")}
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-2">
        <Button disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? t("setup.intro.creating") : t("setup.intro.cta")}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/passkey">{t("setup.intro.haveWalletCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
