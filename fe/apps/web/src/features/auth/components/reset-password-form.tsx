import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/family/ui";
import { emailOtp } from "@/lib/auth-client";
import { useValidationLimits } from "@/lib/validation-limits";
import { makeResetSchema, type ResetInput } from "../schemas/otp-schema";

const RESEND_COOLDOWN_S = 60;

export function ResetPasswordForm({ email }: { email: string }) {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const limits = useValidationLimits();
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const form = useForm<ResetInput>({
    resolver: zodResolver(useMemo(() => makeResetSchema(t, limits), [t, limits])),
    defaultValues: { otp: "", password: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function onSubmit(values: ResetInput) {
    setSubmitting(true);
    const { error } = await emailOtp.resetPassword({
      email,
      otp: values.otp,
      password: values.password,
    });
    setSubmitting(false);
    if (error) {
      form.resetField("otp");
      toast.error(error.message ?? t("reset.errorToast"));
      return;
    }
    toast.success(t("reset.successToast"));
    await navigate({ to: "/login" });
  }

  async function onResend() {
    setCooldown(RESEND_COOLDOWN_S);
    const { error } = await emailOtp.requestPasswordReset({ email });
    if (error) {
      toast.error(error.message ?? t("reset.resendError"));
      setCooldown(0);
      return;
    }
    toast.success(t("reset.resendSent"));
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{t("reset.title")}</CardTitle>
          <CardDescription>{t("reset.description", { email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem className="flex flex-col items-center">
                    <FormLabel className="self-start">{t("reset.otp")}</FormLabel>
                    <FormControl>
                      <InputOTP
                        maxLength={limits.otp.length}
                        value={field.value}
                        onChange={field.onChange}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: limits.otp.length }, (_, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: vị trí slot chính là identity — list tĩnh, không reorder
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage className="self-start" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reset.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("reset.submitting") : t("reset.submit")}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-muted-foreground text-sm">
            <button
              type="button"
              onClick={onResend}
              disabled={cooldown > 0}
              className="text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0 ? t("reset.resendIn", { seconds: cooldown }) : t("reset.resend")}
            </button>
          </div>
          <p className="mt-2 text-center text-muted-foreground text-sm">
            <Link to="/login" className="underline-offset-4 hover:underline">
              {t("reset.backToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
