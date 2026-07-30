// Bước 1 luồng máy mới: nhập địa chỉ ví → tạo passkey MỚI tại chỗ (khoá không
// rời máy) → gửi vật liệu public cho người thân qua cửa public của server.
// Form RHF + Zod (một field — vẫn đi đúng đường validate chuẩn repo).
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, Input } from "@/components/family/ui";
import { knockWithNewPasskey } from "@/features/wallet/api/device-recovery";
import { EmailLookupCard } from "@/features/wallet/components/email-lookup-card";
import { WalletNotConfiguredError } from "@/features/wallet/lib/kit";

export const Route = createFileRoute("/recovery/find-wallet")({
  // ?address=… từ email tra ví (R4 nhóm C): điền sẵn ô địa chỉ, người dùng chỉ
  // bấm tiếp. Optional để các Link cũ không phải truyền search; giá trị lạ →
  // coi như không có, không báo lỗi.
  validateSearch: z.object({
    address: z
      .string()
      .regex(/^C[A-Z2-7]{55}$/)
      .optional()
      .catch(undefined),
  }),
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
  const prefilled = Route.useSearch().address ?? "";
  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { address: prefilled },
  });

  const knock = useMutation({
    mutationFn: (address: string) => knockWithNewPasskey(address),
    onSuccess: async (draft) => {
      await navigate({ to: "/recovery/sent", search: { address: draft.address } });
    },
  });

  return (
    <ProductScreen>
      <ScreenHeader
        title={t("recovery.findWallet.title")}
        description={t("recovery.findWallet.description")}
      />
      <form
        className="flex flex-1 flex-col"
        onSubmit={form.handleSubmit((values) => knock.mutate(values.address.trim()))}
      >
        <Card>
          <CardContent className="space-y-3">
            <label htmlFor="recovery-address" className="flex flex-col gap-2 text-left">
              <span className="font-medium text-foreground text-sm">
                {t("recovery.findWallet.label")}
              </span>
              <div className="relative">
                <Icon
                  name="lock"
                  size={20}
                  className="absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="recovery-address"
                  {...form.register("address")}
                  placeholder={t("recovery.findWallet.placeholder")}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-14 pl-11 font-mono"
                />
              </div>
            </label>
            {form.formState.errors.address ? (
              <p className="text-error text-sm" role="alert">
                {t("recovery.findWallet.invalid")}
              </p>
            ) : null}
            {prefilled !== "" ? (
              <p className="text-success text-sm" role="status">
                {t("recovery.findWallet.prefilled")}
              </p>
            ) : null}
            <p className="text-muted-foreground text-sm">{t("recovery.findWallet.passkeyNote")}</p>
          </CardContent>
        </Card>
        <div className="mt-4">
          <EmailLookupCard />
        </div>
        {knock.isError ? (
          <ErrorBanner type="error" title={t("recovery.findWallet.errorTitle")}>
            {knock.error instanceof WalletNotConfiguredError
              ? t("recovery.findWallet.errors.notConfigured")
              : t("recovery.findWallet.errors.notSent")}
          </ErrorBanner>
        ) : null}
        <PrimaryZone>
          <Button
            type="submit"
            loading={knock.isPending}
            loadingLabel={t("recovery.findWallet.creating")}
          >
            {t("recovery.findWallet.cta")}
          </Button>
        </PrimaryZone>
      </form>
    </ProductScreen>
  );
}
