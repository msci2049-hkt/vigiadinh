// Người thân NHẬN LỜI làm người bảo hộ — chạy trên MÁY CỦA HỌ.
//
// Ngôn ngữ ở màn này là "danh tính bảo mật", KHÔNG phải "ví crypto của bạn":
// người bảo hộ là mẹ, là anh chị — họ đang giúp người thân, không mở tài khoản
// tiền số. (Kỹ thuật bên dưới vẫn là một smart account đầy đủ.)
//
// BẤT BIẾN: khoá sinh ra và Ở LẠI máy này. Thứ duy nhất gửi lên server là ĐỊA
// CHỈ hợp đồng — công khai, ai cũng đọc được trên chain. Server không bao giờ
// sinh khoá hộ và không bao giờ nhận khoá bí mật.

import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icon";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
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
      <ProductScreen className="justify-center">
        <ScreenHeader
          title={t("guardians.accept.badTitle")}
          description={t("guardians.accept.badBody")}
        />
        <PrimaryZone>
          <Button asChild variant="secondary">
            <Link to="/wallet">{t("guardians.accept.homeCta")}</Link>
          </Button>
        </PrimaryZone>
      </ProductScreen>
    );
  }

  if (accept.isSuccess) {
    return (
      <ProductScreen className="justify-center">
        <img
          src="/assets/mascot/mascot-wave.png"
          alt=""
          className="mx-auto h-40 w-40 object-contain"
        />
        <ScreenHeader
          title={t("guardians.accept.doneTitle")}
          description={t("guardians.accept.doneBody")}
        />
        <div
          className="rounded-card border border-dashed bg-paper-2 p-4"
          data-testid="guardian-identity-address"
        >
          <p className="text-muted-foreground text-xs">{t("guardians.accept.addressLabel")}</p>
          <code className="break-all text-xs">{accept.data.address}</code>
        </div>
        <ErrorBanner type="info" title={t("guardians.accept.doneTitle")}>
          {t("guardians.accept.waitingOwner")}
        </ErrorBanner>
      </ProductScreen>
    );
  }

  return (
    <ProductScreen className="justify-center">
      <img
        src="/assets/people/banker-open-left.png"
        alt=""
        className="mx-auto h-48 w-full max-w-xs object-contain"
      />
      <ScreenHeader title={t("guardians.accept.title")} />
      {invite.isLoading ? <LoadingRows /> : null}
      {invite.data ? (
        <p className="product-copy">
          {t("guardians.accept.description", { label: invite.data.label })}
        </p>
      ) : null}

      <Card className="bg-paper-2">
        <CardHeader>
          <CardTitle className="text-base">{t("guardians.accept.whatTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {(
              [
                "guardians.accept.point1",
                "guardians.accept.point2",
                "guardians.accept.point3",
              ] as const
            ).map((pointKey) => (
              <li key={pointKey} className="flex gap-3 text-copy">
                <Icon name="checkCircle" size={20} className="mt-0.5 shrink-0" />
                <span>{t(pointKey)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {accept.isError ? <ErrorState /> : null}

      <PrimaryZone>
        <Button
          loading={accept.isPending}
          disabled={!invite.data}
          onClick={() => accept.mutate()}
          data-testid="guardian-accept-cta"
        >
          <Icon name="fingerprint" />
          {accept.isPending ? t("guardians.accept.creating") : t("guardians.accept.cta")}
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}
