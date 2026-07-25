import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PlusIcon } from "@/components/family/icons";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/family/ui";
import { useValidationLimits, type ValidationLimits } from "@/lib/validation-limits";
import { useUserMutations } from "../hooks/use-user-mutations";

/**
 * Narrow translator: just the create-form error keys → message string.
 * `values` BẮT BUỘC (không optional) — optional param thêm `undefined` vào args
 * tuple → TFunction không assignable dưới exactOptionalPropertyTypes (CLAUDE.md §10).
 */
type CreateUserMessages = (
  key:
    | "users.create.errors.name"
    | "users.create.errors.email"
    | "users.create.errors.password"
    | "users.create.errors.passwordMax",
  values: Record<string, unknown>,
) => string;

// Ngưỡng password từ BE qua useValidationLimits() (D-052) — không mirror số tay.
function makeCreateUserSchema(t: CreateUserMessages, limits: ValidationLimits) {
  const { minLength, maxLength } = limits.password;
  return z.object({
    name: z.string().min(1, { error: t("users.create.errors.name", {}) }),
    email: z.email({ error: t("users.create.errors.email", {}) }),
    password: z
      .string()
      .min(minLength, { error: t("users.create.errors.password", { min: minLength }) })
      .max(maxLength, { error: t("users.create.errors.passwordMax", { max: maxLength }) }),
    role: z.enum(["user", "admin"]),
  });
}

type CreateUserInput = z.infer<ReturnType<typeof makeCreateUserSchema>>;

export function CreateUserDialog() {
  const { t } = useTranslation("admin");
  const [open, setOpen] = useState(false);
  const mutations = useUserMutations();

  const limits = useValidationLimits();
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(useMemo(() => makeCreateUserSchema(t, limits), [t, limits])),
    defaultValues: { name: "", email: "", password: "", role: "user" },
  });

  function onSubmit(values: CreateUserInput) {
    mutations.create.mutate(values, {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> {t("users.create.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.create.title")}</DialogTitle>
          <DialogDescription>{t("users.create.description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("users.create.name")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
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
                  <FormLabel>{t("users.create.email")}</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
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
                  <FormLabel>
                    {t("users.create.password", { min: limits.password.minLength })}
                  </FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("users.create.role")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">user</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutations.create.isPending}>
              {mutations.create.isPending ? t("users.create.submitting") : t("users.create.submit")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
