// Cửa vào trang nhận lời mời — TÁCH THEO HOÀN CẢNH người được mời (A lô 30/07).
//
// Trước bản này trang chỉ có MỘT đường: chưa đăng nhập → một nút /login duy nhất
// (người CHƯA có tài khoản phải tự mò ra chữ "Đăng ký" trong màn login); đã đăng
// nhập → LUÔN tạo passkey + danh tính C… mới, kể cả khi người đó đã có ví — mỗi
// lần bấm là thêm một khoá trong máy, khoá cũ thành rác không xoá được. Giờ:
//   · chưa có tài khoản → /sign-up (token sống qua ?redirect — A.4.3);
//   · đã có ví          → /login, quay lại đây thì DÙNG LẠI danh tính đã có
//                         (địa chỉ C… của ví họ — vốn là thứ duy nhất BE cần).
//
// Mỗi lựa chọn kèm MỘT dòng hint đủ ba tầng (vì sao · bảo vệ gì · làm gì tiếp);
// email hiện trên máy (thường là máy dùng chung) luôn bị che (mask-email).
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBanner } from "@/components/family/error-banner";
import { Icon } from "@/components/family/icons";
import { ProductImage } from "@/components/family/product-image";
import { PrimaryZone, ProductScreen, ScreenHeader } from "@/components/family/screen";
import { Button } from "@/components/family/ui";
import { maskEmail } from "../lib/mask-email";

/** "Bạn đang đăng nhập là ab***@…" + đường đổi tài khoản — email LUÔN bị che. */
export function SignedInAs({ email, token }: { email: string; token: string }) {
  const { t } = useTranslation("fw");
  return (
    <p className="text-copy text-muted-foreground" data-testid="guardian-accept-signed-in">
      {t("guardians.accept.signedInAs", { email: maskEmail(email) })}{" "}
      <Link
        to="/login"
        search={{ redirect: `/guardian/accept?token=${encodeURIComponent(token)}` }}
        className="inline-flex min-h-12 items-center underline"
      >
        {t("guardians.accept.switchAccount")}
      </Link>
    </p>
  );
}

/** Màn "link này không đi tiếp được" — token hỏng / hết hạn / đã dùng / tự mình. */
export function ClosedScreen({
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

/** Nhận lời xong (vừa xong tại chỗ, hoặc mở lại link cũ của chính mình). */
export function DoneScreen({
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
        src="/assets/characters/family-guide-wave.png"
        webpSrc="/assets/characters/family-guide-wave.webp"
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

/** Hoàn cảnh CHƯA đăng nhập: hai cửa, token đi theo ?redirect qua cả hai. */
export function SignedOutChoices({ redirectBack }: { redirectBack: string }) {
  const { t } = useTranslation("fw");
  return (
    <>
      <Button asChild data-testid="guardian-accept-signup">
        <Link to="/sign-up" search={{ redirect: redirectBack }}>
          {t("guardians.accept.signUpCta")}
        </Link>
      </Button>
      <p className="text-muted-foreground text-xs">{t("guardians.accept.signUpHint")}</p>
      <Button asChild variant="secondary" data-testid="guardian-accept-login">
        <Link to="/login" search={{ redirect: redirectBack }}>
          {t("guardians.accept.loginCta")}
        </Link>
      </Button>
      <p className="text-muted-foreground text-xs">{t("guardians.accept.loginHint")}</p>
    </>
  );
}

export type AcceptMode = "reuse" | "create";

/**
 * Hoàn cảnh ĐÃ đăng nhập: có danh tính sẵn trên tài khoản → DÙNG LẠI là đường
 * chính (không đẻ thêm khoá); chưa có gì → tạo mới như cũ.
 */
export function SignedInChoices({
  hasIdentity,
  pendingMode,
  onAccept,
}: {
  hasIdentity: boolean;
  /** Mode đang chạy — nút còn lại bị khoá để không bắn hai lời nhận song song. */
  pendingMode: AcceptMode | null;
  onAccept: (mode: AcceptMode) => void;
}) {
  const { t } = useTranslation("fw");
  if (!hasIdentity) {
    return (
      <Button
        loading={pendingMode === "create"}
        onClick={() => onAccept("create")}
        data-testid="guardian-accept-cta"
      >
        <Icon name="fingerprint" />
        {pendingMode === "create" ? t("guardians.accept.creating") : t("guardians.accept.cta")}
      </Button>
    );
  }
  return (
    <>
      <Button
        loading={pendingMode === "reuse"}
        disabled={pendingMode === "create"}
        onClick={() => onAccept("reuse")}
        data-testid="guardian-accept-reuse"
      >
        <Icon name="shieldCheck" />
        {t("guardians.accept.reuseCta")}
      </Button>
      <p className="text-muted-foreground text-xs">{t("guardians.accept.reuseHint")}</p>
      <Button
        variant="secondary"
        loading={pendingMode === "create"}
        disabled={pendingMode === "reuse"}
        onClick={() => onAccept("create")}
        data-testid="guardian-accept-cta"
      >
        <Icon name="fingerprint" />
        {pendingMode === "create"
          ? t("guardians.accept.creating")
          : t("guardians.accept.createNewCta")}
      </Button>
      <p className="text-muted-foreground text-xs">{t("guardians.accept.createNewHint")}</p>
    </>
  );
}
