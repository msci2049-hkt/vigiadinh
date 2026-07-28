import { zodResolver } from "@hookform/resolvers/zod";
import { postAuthPath, sessionQueryKey } from "@repo/auth";
import { useQueryClient } from "@tanstack/react-query";
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
  FormMessage,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/family/ui";
import { emailOtp, getSession } from "@/lib/auth-client";
import { useValidationLimits } from "@/lib/validation-limits";
import { makeVerifyOtpSchema, type VerifyOtpInput } from "../schemas/otp-schema";

const RESEND_COOLDOWN_S = 60;

export function VerifyEmailForm({ email }: { email: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("auth");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const limits = useValidationLimits();
  const form = useForm<VerifyOtpInput>({
    resolver: zodResolver(useMemo(() => makeVerifyOtpSchema(t, limits), [t, limits])),
    defaultValues: { otp: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function onSubmit(values: VerifyOtpInput) {
    setSubmitting(true);
    const { error } = await emailOtp.verifyEmail({ email, otp: values.otp });
    if (error) {
      setSubmitting(false);
      form.resetField("otp");
      toast.error(error.message ?? t("verify.errorToast"));
      return;
    }
    // verifyEmail (autoSignInAfterVerification) tạo session → vào luôn app
    // (admin → /admin, user thường → /wallet — KHÔNG rơi về "/" = /welcome).
    queryClient.removeQueries({ queryKey: sessionQueryKey });
    const { data } = await getSession().catch(() => ({ data: null }));
    setSubmitting(false);
    toast.success(t("verify.successToast"));
    await navigate({ to: postAuthPath(data?.user?.role) });
  }

  async function onResend() {
    setCooldown(RESEND_COOLDOWN_S);
    const { error } = await emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    if (error) {
      toast.error(error.message ?? t("verify.resendError"));
      setCooldown(0);
      return;
    }
    toast.success(t("verify.resendSent"));
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{t("verify.title")}</CardTitle>
          <CardDescription>{t("verify.description", { email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem className="flex flex-col items-center">
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("verify.submitting") : t("verify.submit")}
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
              {cooldown > 0 ? t("verify.resendIn", { seconds: cooldown }) : t("verify.resend")}
            </button>
          </div>
          <p className="mt-2 text-center text-muted-foreground text-sm">
            <Link to="/login" className="underline-offset-4 hover:underline">
              {t("verify.backToLogin")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
