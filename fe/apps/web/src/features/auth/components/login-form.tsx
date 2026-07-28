import { zodResolver } from "@hookform/resolvers/zod";
import { postAuthPath, sessionQueryKey } from "@repo/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
} from "@/components/family/ui";
import { getSession, signIn } from "@/lib/auth-client";
import { type LoginInput, makeLoginSchema } from "../schemas/login-schema";

export function LoginForm({ redirectTo }: { redirectTo?: string | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("auth");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(useMemo(() => makeLoginSchema(t), [t])),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setSubmitting(false);
      toast.error(error.message ?? t("login.errorToast"));
      return;
    }

    // Session changed → drop the router-guard cache so beforeLoad re-checks.
    queryClient.removeQueries({ queryKey: sessionQueryKey });

    // Explicit ?redirect wins; otherwise land on the role's post-auth home
    // (admin → /admin, plain user → /wallet). Session read is fresh post-login.
    let target = redirectTo;
    if (!target) {
      const { data } = await getSession().catch(() => ({ data: null }));
      target = postAuthPath(data?.user?.role);
    }

    setSubmitting(false);
    toast.success(t("login.successToast"));
    await navigate({ to: target });
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("login.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("login.emailPlaceholder")}
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
                    <FormLabel>{t("login.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>
          </Form>
          <div className="mt-4 space-y-1 text-center text-muted-foreground text-sm">
            <Link
              to="/forgot-password"
              className="block text-primary underline-offset-4 hover:underline"
            >
              {t("login.forgotPassword")}
            </Link>
            <p>
              {t("login.noAccount")}{" "}
              <Link to="/sign-up" className="text-primary underline-offset-4 hover:underline">
                {t("login.signUpLink")}
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
