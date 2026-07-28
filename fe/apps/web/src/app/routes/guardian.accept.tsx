// Người thân NHẬN LỜI làm người bảo hộ — chạy trên MÁY CỦA HỌ.
//
// Route CÔNG KHAI có chủ đích (bug A phiên 28/07): trước đây file nằm dưới
// _authenticated nên mở link mời là bị đá thẳng sang /login — ô email + mật
// khẩu trần, không một chữ giải thích. Hình dạng đó TRÙNG KHÍT trang lừa đảo,
// và dạy người thân thói quen nguy hiểm. Nguyên tắc mới: GIẢI THÍCH TRƯỚC,
// đăng nhập sau — trang đọc nhãn public theo token, nói rõ ai mời / giúp được
// gì / KHÔNG làm được gì, rồi mới đưa người ta đi đăng nhập (giữ token qua cả
// đăng ký + OTP bằng ?redirect).
//
// Ngôn ngữ ở màn này là "danh tính bảo mật", KHÔNG phải "ví crypto của bạn":
// người bảo hộ là mẹ, là anh chị — họ đang giúp người thân, không mở tài khoản
// tiền số. (Kỹ thuật bên dưới vẫn là một smart account đầy đủ.)
//
// BẤT BIẾN: khoá sinh ra và Ở LẠI máy này. Thứ duy nhất gửi lên server là ĐỊA
// CHỈ hợp đồng — công khai, ai cũng đọc được trên chain. Server không bao giờ
// sinh khoá hộ và không bao giờ nhận khoá bí mật.

import { formatDateTime } from "@repo/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ProductImage } from "@/components/family/product-image";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/family/ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { acceptInvite, inviteByTokenOptions } from "@/features/family/api/invites";
import { ErrorState, LoadingRows } from "@/features/family/components/screen-state";
import { createGuardianIdentity } from "@/features/wallet/api/guardian-identity";

export const Route = createFileRoute("/guardian/accept")({
  validateSearch: z.object({ token: z.string().min(1).catch("") }),
  component: GuardianAcceptScreen,
});

function GuardianAcceptScreen() {
  const { t, i18n } = useTranslation("fw");
  const { token } = Route.useSearch();
  const { user, isPending: sessionPending } = useCurrentUser();

  const invite = useQuery({ ...inviteByTokenOptions(token), enabled: token.length > 0 });

  const accept = useMutation({
    mutationFn: async () => {
      const identity = await createGuardianIdentity();
      await acceptInvite({ token, guardianAddress: identity.address });
      return identity;
    },
  });

  // ---- Token sai / không tồn tại — câu tử tế, không mã lỗi trần.
  if (token.length === 0 || invite.isError) {
    return (
      <ProductScreen className="justify-center">
        <ScreenHeader
          title={t("guardians.accept.badTitle")}
          description={t("guardians.accept.badBody")}
        />
        <PrimaryZone>
          <Button asChild variant="secondary">
            <Link to="/">{t("guardians.accept.declineCta")}</Link>
          </Button>
        </PrimaryZone>
      </ProductScreen>
    );
  }

  // ---- Hết hạn / đã dùng — hai câu KHÁC NHAU (người thân cần biết nên xin
  // link mới hay thôi). BE cũ 404 các ca này → rơi vào nhánh isError ở trên.
  if (invite.data && invite.data.usable === false) {
    const expired = invite.data.reason === "expired";
    return (
      <ProductScreen className="justify-center">
        <ScreenHeader
          title={t(expired ? "guardians.accept.expiredTitle" : "guardians.accept.usedTitle")}
          description={
            expired
              ? t("guardians.accept.expiredBody", {
                  date: invite.data.expires_at
                    ? formatDateTime(invite.data.expires_at, { locale: i18n.language })
                    : "",
                })
              : t("guardians.accept.usedBody")
          }
        />
        <PrimaryZone>
          <Button asChild variant="secondary">
            <Link to="/">{t("guardians.accept.declineCta")}</Link>
          </Button>
        </PrimaryZone>
      </ProductScreen>
    );
  }

  // ---- Nhận lời XONG — xác nhận rõ ràng, không im lặng.
  if (accept.isSuccess) {
    return (
      <ProductScreen className="justify-center">
        <ProductImage
          src="/assets/mascot/mascot-wave.png"
          webpSrc="/assets/mascot/mascot-wave.webp"
          avifSrc="/assets/mascot/mascot-wave.avif"
          alt=""
          width={640}
          height={640}
          priority
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
        <PrimaryZone>
          <Button asChild>
            <Link to="/wallet">{t("guardians.accept.homeCta")}</Link>
          </Button>
        </PrimaryZone>
      </ProductScreen>
    );
  }

  const ownerName = invite.data?.owner_name;
  const signedIn = user !== null;
  // Giữ token qua đăng nhập/đăng ký + OTP — sanitize ở từng route đích.
  const redirectBack = `/guardian/accept?token=${encodeURIComponent(token)}`;

  return (
    <ProductScreen className="justify-center">
      <ProductImage
        src="/assets/people/banker-open-left.png"
        webpSrc="/assets/people/banker-open-left.webp"
        avifSrc="/assets/people/banker-open-left.avif"
        alt=""
        width={960}
        height={1280}
        priority
        className="mx-auto h-48 w-full max-w-xs object-contain"
      />
      {invite.isLoading || sessionPending ? <LoadingRows /> : null}
      {invite.data ? (
        <>
          <ScreenHeader
            title={
              ownerName
                ? t("guardians.accept.inviteTitle", { owner: ownerName })
                : t("guardians.accept.title")
            }
          />
          <p className="product-copy">
            {t("guardians.accept.description", { label: invite.data.label })}
          </p>

          {/* Hai khối tách bạch — khối "KHÔNG làm được gì" quan trọng ngang
              khối kia: nó dập tan đúng nỗi lo "mình cầm tiền của nó à?". */}
          <Card className="bg-paper-2">
            <CardHeader>
              <CardTitle className="text-base">{t("guardians.accept.helpTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(["guardians.accept.point2", "guardians.accept.point3"] as const).map((key) => (
                  <li key={key} className="flex gap-3 text-copy">
                    <Icon name="checkCircle" size={20} className="mt-0.5 shrink-0" />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-paper-2">
            <CardHeader>
              <CardTitle className="text-base">{t("guardians.accept.cantTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(
                  [
                    "guardians.accept.point1",
                    "guardians.accept.cant2",
                    "guardians.accept.cant3",
                  ] as const
                ).map((key) => (
                  <li key={key} className="flex gap-3 text-copy">
                    <Icon name="xCircle" size={20} className="mt-0.5 shrink-0" />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <p className="text-copy text-muted-foreground">{t("guardians.accept.needLine")}</p>
          {invite.data.expires_at ? (
            <p className="text-muted-foreground text-xs">
              {t("guardians.accept.expiryLine", {
                date: formatDateTime(invite.data.expires_at, { locale: i18n.language }),
              })}
            </p>
          ) : null}

          {accept.isError ? <ErrorState /> : null}

          <PrimaryZone>
            {signedIn ? (
              // Đã có phiên → tạo danh tính (passkey) + nhận lời ngay tại đây.
              <Button
                loading={accept.isPending}
                onClick={() => accept.mutate()}
                data-testid="guardian-accept-cta"
              >
                <Icon name="fingerprint" />
                {accept.isPending ? t("guardians.accept.creating") : t("guardians.accept.cta")}
              </Button>
            ) : (
              // Chưa có phiên → đăng nhập/đăng ký, token đi theo ?redirect.
              <Button asChild data-testid="guardian-accept-login">
                <Link to="/login" search={{ redirect: redirectBack }}>
                  {t("guardians.accept.agreeCta")}
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link to="/">{t("guardians.accept.declineCta")}</Link>
            </Button>
          </PrimaryZone>
        </>
      ) : null}
    </ProductScreen>
  );
}
