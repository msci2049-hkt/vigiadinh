import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@repo/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { emailOtp } from "@/lib/auth-client";
import { type ForgotInput, makeForgotSchema } from "../schemas/otp-schema";

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ForgotInput>({
    resolver: zodResolver(useMemo(() => makeForgotSchema(t), [t])),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotInput) {
    setSubmitting(true);
    // Privacy-preserving: BE trả success kể cả email không tồn tại (không lộ
    // user-enumeration). Luôn chuyển sang bước nhập OTP + mật khẩu mới.
    const { error } = await emailOtp.requestPasswordReset({ email: values.email });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? t("forgot.errorToast"));
      return;
    }
    toast.success(t("forgot.sentToast"));
    await navigate({ to: "/reset-password", search: { email: values.email } });
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{t("forgot.title")}</CardTitle>
          <CardDescription>{t("forgot.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("forgot.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("forgot.emailPlaceholder")}
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("forgot.submitting") : t("forgot.submit")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-muted-foreground text-sm">
            <Link to="/login" className="underline-offset-4 hover:underline">
              {t("forgot.backToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
