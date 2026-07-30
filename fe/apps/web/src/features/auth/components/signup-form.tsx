import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/family/error-banner";
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
} from "@/components/family/ui";
import { signUp } from "@/lib/auth-client";
import { useValidationLimits } from "@/lib/validation-limits";
import { makeSignupSchema, type SignupInput } from "../schemas/signup-schema";

export function SignupForm({ redirectTo }: { redirectTo?: string | undefined }) {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");
  const limits = useValidationLimits();
  const [submitting, setSubmitting] = useState(false);
  // Email đã có tài khoản (BE trả USER_ALREADY_EXISTS) — giữ lại để hiện banner
  // dẫn sang Đăng nhập MANG SẴN email đó, thay vì toast lỗi chung rồi bỏ mặc.
  const [takenEmail, setTakenEmail] = useState<string | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(useMemo(() => makeSignupSchema(t, limits), [t, limits])),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    setTakenEmail(null);
    // INVARIANT: never send `role` — server owns it (see @repo/auth).
    const { error } = await signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (error) {
      setSubmitting(false);
      // BE chối email trùng bằng mã riêng (hooks.before, be/src/lib/auth.ts —
      // đánh đổi tiết lộ có chủ đích, rate-limit 3/60s vẫn gác): KHÔNG đi tiếp
      // sang màn OTP, KHÔNG gửi email — hiện đường đúng ngay tại form.
      if (error.code === "USER_ALREADY_EXISTS") {
        setTakenEmail(values.email);
        return;
      }
      toast.error(error.message ?? t("signup.errorToast"));
      return;
    }

    // BE gửi OTP xác minh tự động khi sign-up (emailVerification.sendOnSignUp +
    // emailOTP override). Điều hướng sang trang verify, mang email theo.
    setSubmitting(false);
    toast.success(t("signup.successToast"));
    // redirect đi tiếp qua verify (A.4.3) — token lời mời guardian sống trọn luồng.
    await navigate({
      to: "/verify-email",
      search: { email: values.email, redirect: redirectTo },
    });
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{t("signup.title")}</CardTitle>
          <CardDescription>{t("signup.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signup.name")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signup.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("signup.emailPlaceholder")}
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signup.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("signup.submitting") : t("signup.submit")}
              </Button>
            </form>
          </Form>
          {takenEmail ? (
            <div className="mt-4">
              <ErrorBanner type="info" title={t("signup.emailTakenTitle")}>
                <p>{t("signup.emailTaken")}</p>
                <Button asChild className="mt-3 w-full">
                  <Link to="/login" search={{ email: takenEmail, redirect: redirectTo }}>
                    {t("signup.emailTakenCta")}
                  </Link>
                </Button>
              </ErrorBanner>
            </div>
          ) : null}
          <p className="mt-4 text-center text-muted-foreground text-sm">
            {t("signup.haveAccount")}{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              {t("signup.loginLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
