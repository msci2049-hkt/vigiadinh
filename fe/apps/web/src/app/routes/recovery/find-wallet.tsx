// Bước 1 luồng máy mới: nhập địa chỉ ví → tạo passkey MỚI tại chỗ (khoá không
// rời máy) → gửi vật liệu public cho người thân qua cửa public của server.
// Form RHF + Zod (một field — vẫn đi đúng đường validate chuẩn repo).
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input } from "@repo/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { knockWithNewPasskey } from "@/features/wallet/api/device-recovery";
import { WalletNotConfiguredError } from "@/features/wallet/lib/kit";

export const Route = createFileRoute("/recovery/find-wallet")({
  component: RecoveryFindWalletScreen,
});

const schema = z.object({
  // Hằng số mạng Stellar (C + 55 base32) — không phải ngưỡng validate BE.
  address: z.string().regex(/^C[A-Z2-7]{55}$/, "invalid"),
});
type FormInput = z.infer<typeof schema>;

function RecoveryFindWalletScreen() {
  const { t } = useTranslation("fw");
  const navigate = useNavigate();
  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { address: "" },
  });

  const knock = useMutation({
    mutationFn: (address: string) => knockWithNewPasskey(address),
    onSuccess: async (draft) => {
      await navigate({ to: "/recovery/sent", search: { address: draft.address } });
    },
  });

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("recovery.findWallet.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("recovery.findWallet.description")}</p>

      <form
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit((values) => knock.mutate(values.address.trim()))}
      >
        <label htmlFor="recovery-address" className="flex flex-col gap-1 text-left">
          <span className="text-foreground text-sm">{t("recovery.findWallet.label")}</span>
          <Input
            id="recovery-address"
            {...form.register("address")}
            placeholder={t("recovery.findWallet.placeholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {form.formState.errors.address ? (
          <p className="text-destructive text-sm" role="alert">
            {t("recovery.findWallet.invalid")}
          </p>
        ) : null}
        {knock.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {knock.error instanceof WalletNotConfiguredError
              ? t("recovery.findWallet.errors.notConfigured")
              : t("recovery.findWallet.errors.notSent")}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">{t("recovery.findWallet.passkeyNote")}</p>
        <Button type="submit" disabled={knock.isPending}>
          {knock.isPending ? t("recovery.findWallet.creating") : t("recovery.findWallet.cta")}
        </Button>
      </form>
    </main>
  );
}
