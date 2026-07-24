// Người thân NHẬN LỜI làm người bảo hộ — chạy trên MÁY CỦA HỌ.
//
// Ngôn ngữ ở màn này là "danh tính bảo mật", KHÔNG phải "ví crypto của bạn":
// người bảo hộ là mẹ, là anh chị — họ đang giúp người thân, không mở tài khoản
// tiền số. (Kỹ thuật bên dưới vẫn là một smart account đầy đủ.)
//
// BẤT BIẾN: khoá sinh ra và Ở LẠI máy này. Thứ duy nhất gửi lên server là ĐỊA
// CHỈ hợp đồng — công khai, ai cũng đọc được trên chain. Server không bao giờ
// sinh khoá hộ và không bao giờ nhận khoá bí mật.
import { Button, Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { acceptInvite, inviteByTokenOptions } from "@/features/family/api/invites";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { createGuardianIdentity } from "@/features/wallet/api/guardian-identity";

export const Route = createFileRoute("/_authenticated/guardian/accept")({
  validateSearch: z.object({ token: z.string().min(1).catch("") }),
  component: GuardianAcceptScreen,
});

function GuardianAcceptScreen() {
  const { t } = useTranslation("fw");
  const { token } = Route.useSearch();

  const invite = useQuery({ ...inviteByTokenOptions(token), enabled: token.length > 0 });

  const accept = useMutation({
    mutationFn: async () => {
      const identity = await createGuardianIdentity();
      await acceptInvite({ token, guardianAddress: identity.address });
      return identity;
    },
  });

  if (token.length === 0 || invite.isError) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="font-semibold text-2xl text-foreground">{t("guardians.accept.badTitle")}</h1>
        <p className="text-muted-foreground text-sm">{t("guardians.accept.badBody")}</p>
        <Button asChild variant="outline">
          <Link to="/wallet">{t("guardians.accept.homeCta")}</Link>
        </Button>
      </main>
    );
  }

  if (accept.isSuccess) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="font-semibold text-2xl text-foreground">
          {t("guardians.accept.doneTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("guardians.accept.doneBody")}</p>
        <div
          className="rounded-md border border-border p-3"
          data-testid="guardian-identity-address"
        >
          <p className="text-muted-foreground text-xs">{t("guardians.accept.addressLabel")}</p>
          <code className="break-all text-xs">{accept.data.address}</code>
        </div>
        <p className="text-muted-foreground text-xs">{t("guardians.accept.waitingOwner")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-semibold text-2xl text-foreground">{t("guardians.accept.title")}</h1>
      {invite.isLoading ? <LoadingRows /> : null}
      {invite.data ? (
        <p className="text-muted-foreground text-sm">
          {t("guardians.accept.description", { label: invite.data.label })}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("guardians.accept.whatTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground text-sm">
            <li>{t("guardians.accept.point1")}</li>
            <li>{t("guardians.accept.point2")}</li>
            <li>{t("guardians.accept.point3")}</li>
          </ul>
        </CardContent>
      </Card>

      {accept.isError ? <ErrorState /> : null}

      <Button
        disabled={accept.isPending || !invite.data}
        onClick={() => accept.mutate()}
        data-testid="guardian-accept-cta"
      >
        {accept.isPending ? t("guardians.accept.creating") : t("guardians.accept.cta")}
      </Button>
    </main>
  );
}
