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
// HAI HOÀN CẢNH của người được mời (A lô 30/07 — trước đây chỉ một đường):
//   · CHƯA có tài khoản → nút /sign-up riêng, xong quay lại đúng lời mời;
//   · ĐÃ có ví          → nút /login riêng; quay lại đây thì DÙNG LẠI danh tính
//     sẵn có (địa chỉ C… của ví) — không bị ép tạo passkey mới.
//
// BỐN TRẠNG THÁI (bug A lần hai, 28/07): 1 chưa đăng nhập · 2 đã đăng nhập ·
// 3 đã nhận lời (accepted_by_me) · 4 chính chủ ví mở link của mình (is_owner).
//
// Ngôn ngữ ở màn này là "danh tính bảo mật", KHÔNG phải "ví crypto của bạn".
// BẤT BIẾN: khoá sinh ra và Ở LẠI máy này; thứ duy nhất gửi lên server là ĐỊA
// CHỈ hợp đồng (công khai trên chain).

import { formatDateTime } from "@repo/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ProductImage } from "@/components/family/product-image";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { acceptInvite, inviteByTokenOptions } from "@/features/family/api/invites";
import { walletsOptions } from "@/features/family/api/wallets";
import { AcceptErrorBanner } from "@/features/family/components/accept-error-banner";
import {
  type AcceptMode,
  ClosedScreen,
  DoneScreen,
  SignedInAs,
  SignedInChoices,
  SignedOutChoices,
} from "@/features/family/components/guardian-accept-entry";
import { GuardianAcceptIntro } from "@/features/family/components/guardian-accept-intro";
import { LoadingRows } from "@/features/family/components/screen-state";
import { mapAcceptError } from "@/features/family/lib/accept-error";
import { createGuardianIdentity } from "@/features/wallet/api/guardian-identity";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/guardian/accept")({
  validateSearch: z.object({ token: z.string().min(1).catch("") }),
  component: GuardianAcceptScreen,
});

function GuardianAcceptScreen() {
  const { t, i18n } = useTranslation("fw");
  const { token } = Route.useSearch();
  const { user, isPending: sessionPending } = useCurrentUser();

  const invite = useQuery({ ...inviteByTokenOptions(token), enabled: token.length > 0 });
  // Danh tính sẵn có trên tài khoản (ví của họ, hoặc danh tính bảo hộ đã tạo
  // trước đó) — CHỈ hỏi khi có phiên: trang này public, hỏi lúc chưa đăng nhập
  // là ăn 401 vô cớ.
  const wallets = useQuery({ ...walletsOptions, enabled: user !== null });
  const existingIdentity = wallets.data?.[0] ?? null;

  const accept = useMutation({
    mutationFn: async (mode: AcceptMode) => {
      // DÙNG LẠI: thứ BE cần chỉ là ĐỊA CHỈ công khai — không đụng passkey,
      // không sinh khoá mới. Vân tay chỉ được hỏi khi họ KÝ phiếu sau này.
      if (mode === "reuse") {
        if (!existingIdentity) throw new Error("NO_EXISTING_IDENTITY");
        await acceptInvite({ token, guardianAddress: existingIdentity.stellarAddress });
        return { address: existingIdentity.stellarAddress };
      }
      // TẠO MỚI: email vào TÊN passkey — một người có thể vừa có ví của mình,
      // vừa làm người bảo hộ cho vài ví khác; khoá trùng tên là không dùng được.
      const identity = await createGuardianIdentity({ ownerLabel: user?.email });
      await acceptInvite({ token, guardianAddress: identity.address });
      return identity;
    },
  });
  const pendingMode: AcceptMode | null = accept.isPending ? (accept.variables ?? null) : null;

  // ---- Token sai / không tồn tại (404) — câu "xin link mới", không mã lỗi trần.
  const loadStatus = invite.error instanceof ApiError ? invite.error.status : null;
  if (token.length === 0 || (invite.isError && loadStatus === 404)) {
    return (
      <ClosedScreen title={t("guardians.accept.badTitle")} body={t("guardians.accept.badBody")}>
        <Button asChild variant="secondary">
          <Link to="/">{t("guardians.accept.declineCta")}</Link>
        </Button>
      </ClosedScreen>
    );
  }

  // ---- Mạng đứt / hệ thống bận (không phải 404): lời mời VẪN CÒN — trước đây
  // nhánh này nói "link không dùng được", người thân tưởng link chết và bỏ cuộc.
  if (invite.isError) {
    return (
      <ClosedScreen
        title={t("guardians.accept.loadFailedTitle")}
        body={t("guardians.accept.loadFailedBody")}
      >
        <Button onClick={() => void invite.refetch()} data-testid="guardian-accept-retry">
          {t("guardians.accept.retryCta")}
        </Button>
        <Button asChild variant="ghost">
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
  const acceptError = accept.isError ? mapAcceptError(accept.error) : null;

  return (
    <ProductScreen className="justify-center">
      <ProductImage
        src="/assets/characters/european-family-hero.png"
        webpSrc="/assets/characters/european-family-hero.webp"
        alt=""
        width={1122}
        height={1402}
        priority
        className="family-scene family-scene--compact"
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
              <SignedInChoices
                hasIdentity={existingIdentity !== null}
                pendingMode={pendingMode}
                onAccept={(mode) => accept.mutate(mode)}
              />
            ) : (
              <SignedOutChoices redirectBack={redirectBack} />
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
