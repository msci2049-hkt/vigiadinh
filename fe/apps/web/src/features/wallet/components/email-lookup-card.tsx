// "Tôi không nhớ địa chỉ ví" — tra bằng email (R4 nhóm C). Màn này KHÔNG bao
// giờ hiện địa chỉ ví và không nói email có tồn tại hay không (chống lộ danh
// sách người dùng): sau khi gửi chỉ hiện "nếu email này có ví…" — y hệt nhau
// cho email thật lẫn email bịa. Địa chỉ đi qua HỘP THƯ của chính chủ.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Icon } from "@/components/family/icons";
import { Button, Card, CardContent, Input } from "@/components/family/ui";
import { lookupWalletByEmail } from "../api/device-recovery";

const schema = z.object({ email: z.email() });
type FormInput = z.infer<typeof schema>;

export function EmailLookupCard() {
  const { t } = useTranslation("fw");
  const form = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const lookup = useMutation({ mutationFn: lookupWalletByEmail });

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="font-semibold text-foreground text-sm">
          {t("recovery.findWallet.lookup.title")}
        </h2>
        {lookup.isSuccess ? (
          // Câu DUY NHẤT được phép sau khi gửi — không "đã tìm thấy", không
          // "email không tồn tại". Cùng một màn cho mọi email.
          <p className="text-foreground text-sm" role="status">
            {t("recovery.findWallet.lookup.sentNote")}
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => lookup.mutate(values.email.trim()))}
          >
            <p className="text-muted-foreground text-sm">{t("recovery.findWallet.lookup.note")}</p>
            <label htmlFor="lookup-email" className="flex flex-col gap-2 text-left">
              <span className="font-medium text-foreground text-sm">
                {t("recovery.findWallet.lookup.emailLabel")}
              </span>
              <Input
                id="lookup-email"
                type="email"
                {...form.register("email")}
                placeholder={t("recovery.findWallet.lookup.emailPlaceholder")}
                autoComplete="email"
                spellCheck={false}
                className="h-14"
              />
            </label>
            {form.formState.errors.email ? (
              <p className="text-error text-sm" role="alert">
                {t("recovery.findWallet.lookup.invalid")}
              </p>
            ) : null}
            {lookup.isError ? (
              <p className="text-error text-sm" role="alert">
                {t("recovery.findWallet.lookup.errorNotSent")}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="outline"
              loading={lookup.isPending}
              loadingLabel={t("recovery.findWallet.lookup.sending")}
            >
              <Icon name="send" size={20} />
              {t("recovery.findWallet.lookup.cta")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
