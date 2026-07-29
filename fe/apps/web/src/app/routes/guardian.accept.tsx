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
// BỐN TRẠNG THÁI (bug A lần hai, 28/07 — trước đây chỉ đổi mỗi nhãn nút):
//   1 CHƯA đăng nhập      → giới thiệu đầy đủ + [đồng ý] / [không biết người này]
//   2 ĐÃ đăng nhập        → giới thiệu THU GỌN + "Bạn đang đăng nhập là <email>"
//                           + nút tạo danh tính
//   3 ĐÃ nhận lời (chính tài khoản này — BE trả viewer.accepted_by_me)
//                         → màn xác nhận, không hiện lại nút tạo
//   4 CHÍNH CHỦ VÍ mở link của mình (viewer.is_owner)
//                         → chặn: tự làm guardian của mình là mất máy mất luôn
//                           "người cứu". BE chặn thật (GUARDIAN_IS_OWNER),
//                           màn này chỉ nói câu tử tế.
//
// Ngôn ngữ ở màn này là "danh tính bảo mật", KHÔNG phải "ví crypto của bạn".
// BẤT BIẾN: khoá sinh ra và Ở LẠI máy này; thứ duy nhất gửi lên server là ĐỊA
// CHỈ hợp đồng (công khai trên chain).

import { formatDateTime } from "@repo/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ProductImage } from "@/components/family/product-image";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { acceptInvite, inviteByTokenOptions } from "@/features/family/api/invites";
import { AcceptErrorBanner } from "@/features/family/components/accept-error-banner";
import { GuardianAcceptIntro } from "@/features/family/components/guardian-accept-intro";
import { LoadingRows } from "@/features/family/components/screen-state";
import { mapAcceptError } from "@/features/family/lib/accept-error";
import { createGuardianIdentity } from "@/features/wallet/api/guardian-identity";

export const Route = createFileRoute("/guardian/accept")({
  validateSearch: z.object({ token: z.string().min(1).catch("") }),
  component: GuardianAcceptScreen,
});

/** "Bạn đang đăng nhập là <email>" + đường đổi tài khoản — trạng thái 2 và 3. */
function SignedInAs({ email, token }: { email: string; token: string }) {
  const { t } = useTranslation("fw");
  return (
    <p className="text-copy text-muted-foreground" data-testid="guardian-accept-signed-in">
      {t("guardians.accept.signedInAs", { email })}{" "}
      <Link
        to="/login"
        search={{ redirect: `/guardian/accept?token=${encodeURIComponent(token)}` }}
        className="underline"
      >
        {t("guardians.accept.switchAccount")}
      </Link>
    </p>
  );
}

/** Màn "link này không đi tiếp được" — token hỏng / hết hạn / đã dùng / tự mình. */
function ClosedScreen({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <ProductScreen className="justify-center">
      <ScreenHeader title={title} description={body} />
      <PrimaryZone>{children}</PrimaryZone>
    </ProductScreen>
  );
}

/** Trạng thái 3 — nhận lời xong (vừa xong tại chỗ, hoặc mở lại link cũ). */
function DoneScreen({
  ownerName,
  address,
  email,
  token,
}: {
  ownerName?: string | null | undefined;
  address?: string;
  email: string;
  token: string;
}) {
  const { t } = useTranslation("fw");
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
        description={
          address
            ? t("guardians.accept.doneBody")
            : ownerName
              ? t("guardians.accept.alreadyBody", { owner: ownerName })
              : t("guardians.accept.doneBody")
        }
      />
      {address ? (
        <div
          className="rounded-card border border-dashed bg-paper-2 p-4"
          data-testid="guardian-identity-address"
        >
          <p className="text-muted-foreground text-xs">{t("guardians.accept.addressLabel")}</p>
          <code className="break-all text-xs">{address}</code>
        </div>
      ) : null}
      <ErrorBanner type="info" title={t("guardians.accept.doneTitle")}>
        {t("guardians.accept.waitingOwner")}
      </ErrorBanner>
      {email ? <SignedInAs email={email} token={token} /> : null}
      <PrimaryZone>
        <Button asChild>
          <Link to="/wallet">{t("guardians.accept.homeCta")}</Link>
        </Button>
      </PrimaryZone>
    </ProductScreen>
  );
}

function GuardianAcceptScreen() {
  const { t, i18n } = useTranslation("fw");
  const { token } = Route.useSearch();
  const { user, isPending: sessionPending } = useCurrentUser();

  const invite = useQuery({ ...inviteByTokenOptions(token), enabled: token.length > 0 });

  const accept = useMutation({
    mutationFn: async () => {
      // Email vào TÊN passkey — một người có thể vừa có ví của mình, vừa làm
      // người bảo hộ cho vài ví khác; khoá trùng tên là không dùng được.
      const identity = await createGuardianIdentity({ ownerLabel: user?.email });
      await acceptInvite({ token, guardianAddress: identity.address });
      return identity;
    },
  });

  // ---- Token sai / không tồn tại — câu tử tế, không mã lỗi trần.
  if (token.length === 0 || invite.isError) {
    return (
      <ClosedScreen title={t("guardians.accept.badTitle")} body={t("guardians.accept.badBody")}>
        <Button asChild variant="secondary">
          <Link to="/">{t("guardians.accept.declineCta")}</Link>
        </Button>
      </ClosedScreen>
    );
  }

  const data = invite.data;
  const viewer = data?.viewer;
  const email = user?.email ?? "";

  // ---- Trạng thái 4 — chủ ví mở link của CHÍNH mình: chặn, không nút tạo.
  if (viewer?.is_owner) {
    return (
      <ClosedScreen title={t("guardians.accept.selfTitle")} body={t("guardians.accept.selfBody")}>
        <Button asChild variant="secondary">
          <Link to="/wallet">{t("guardians.accept.homeCta")}</Link>
        </Button>
      </ClosedScreen>
    );
  }

  // ---- Trạng thái 3 — vừa nhận lời xong tại chỗ.
  if (accept.isSuccess) {
    return <DoneScreen address={accept.data.address} email={email} token={token} />;
  }

  // ---- Hết hạn / đã dùng — nhưng "đã dùng bởi CHÍNH tôi" là màn xác nhận
  // (trạng thái 3), không phải câu "link chết" lạnh lùng.
  if (data && data.usable === false) {
    if (data.reason === "used" && viewer?.accepted_by_me) {
      return <DoneScreen ownerName={data.owner_name} email={email} token={token} />;
    }
    const expired = data.reason === "expired";
    return (
      <ClosedScreen
        title={t(expired ? "guardians.accept.expiredTitle" : "guardians.accept.usedTitle")}
        body={
          expired
            ? t("guardians.accept.expiredBody", {
                date: data.expires_at
                  ? formatDateTime(data.expires_at, { locale: i18n.language })
                  : "",
              })
            : t("guardians.accept.usedBody")
        }
      >
        <Button asChild variant="secondary">
          <Link to="/">{t("guardians.accept.declineCta")}</Link>
        </Button>
      </ClosedScreen>
    );
  }

  // ---- Trạng thái 1 (chưa đăng nhập) / 2 (đã đăng nhập, giới thiệu thu gọn).
  const ownerName = data?.owner_name;
  const signedIn = user !== null;
  const redirectBack = `/guardian/accept?token=${encodeURIComponent(token)}`;
  // Lỗi ở bước cuối KHÔNG còn gộp một câu: bốn nguyên nhân dưới đây đòi bốn việc
  // khác hẳn nhau (đăng nhập lại · xin link mới · thôi · tạo lại passkey), mà câu
  // chung "Chưa tải được mục này" thì không nói được cái nào.
  const acceptError = accept.isError ? mapAcceptError(accept.error) : null;

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
      {data ? (
        <>
          <ScreenHeader
            title={
              ownerName
                ? t("guardians.accept.inviteTitle", { owner: ownerName })
                : t("guardians.accept.title")
            }
          />
          <p className="product-copy">{t("guardians.accept.description", { label: data.label })}</p>

          <GuardianAcceptIntro collapsed={signedIn} />

          {signedIn ? (
            <SignedInAs email={email} token={token} />
          ) : (
            <p className="text-copy text-muted-foreground">{t("guardians.accept.needLine")}</p>
          )}
          {data.expires_at ? (
            <p className="text-muted-foreground text-xs">
              {t("guardians.accept.expiryLine", {
                date: formatDateTime(data.expires_at, { locale: i18n.language }),
              })}
            </p>
          ) : null}

          {acceptError ? (
            <AcceptErrorBanner view={acceptError} redirectBack={redirectBack} />
          ) : null}

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
