// "Ví đang khoá" — nói TRƯỚC khi người dùng mất công, không phải sau.
//
// Sự cố 29/07: ví 0 người bảo hộ, chủ ví gõ số tiền → chọn người nhận → màn xác
// nhận → rồi mới chết bằng một câu chung chung. Toàn bộ dữ kiện để chặn ở bước
// ĐẦU đã nằm sẵn trên máy (số người đã nhận lời). Component này là chỗ nói ra.
//
// Ba tầng BẮT BUỘC trong mọi lần chặn (luật lô 29/07): vì sao chặn · đang bảo vệ
// cái gì · giờ làm gì để đi tiếp. Thiếu một tầng là quay lại đúng lỗi cũ.
//
// Ngôn ngữ: người nhận thông báo này là người không rành kỹ thuật. CẤM "registry",
// "sponsorship", "contract", "on-chain", "gas" trong copy — mã kỹ thuật (nếu có)
// để dòng nhỏ mờ ở màn lỗi, không phải ở đây.
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/family/dialog";
import { Icon } from "@/components/family/icons";
import { Button } from "@/components/family/ui";
import type { WalletLock, WalletLockStep } from "../lib/wallet-lock";

type LockedInfo = Extract<WalletLock, { locked: true }>;

/** Đích của nút chính — hai bước KHÁC NHAU, chỉ sai đường là người dùng kẹt. */
export function lockCtaTo(step: WalletLockStep): "/setup/choose-guardians" | "/setup/review" {
  return step === "invite" ? "/setup/choose-guardians" : "/setup/review";
}

/** Thân thông báo — dùng chung cho popup (hub) và khối chặn tại chỗ (màn Gửi). */
export function WalletLockedBody({ lock }: { lock: LockedInfo }) {
  const { t } = useTranslation("fw");
  return (
    <div className="flex flex-col gap-3 text-left">
      {/* Tầng 1 — VÌ SAO bị chặn. */}
      <p className="text-copy text-muted-foreground">
        {t(lock.step === "invite" ? "wallet.locked.whyInvite" : "wallet.locked.whyRegister", {
          required: lock.required,
        })}
      </p>
      {/* Tầng 2 — ĐANG BẢO VỆ CÁI GÌ. Đây là câu người dùng cần nhất lúc hoảng. */}
      <p className="text-copy">
        <span className="font-semibold text-foreground">{t("wallet.locked.safeLabel")}</span>{" "}
        <span className="text-muted-foreground">{t("wallet.locked.safeBody")}</span>
      </p>
      {/* Tầng 3 — ĐANG Ở ĐÂU trên đường đi (con số thật, không phải lời hứa). */}
      <p
        className="rounded-card border border-dashed bg-paper-2 p-3 font-semibold text-foreground text-sm"
        data-testid="wallet-locked-progress"
      >
        {t("wallet.locked.progress", { available: lock.available, required: lock.required })}
      </p>
    </div>
  );
}

/** Nút chính + nút "để sau" — tách ra để popup và khối tại chỗ dùng chung. */
function LockActions({
  lock,
  onDismiss,
}: {
  lock: LockedInfo;
  onDismiss?: (() => void) | undefined;
}) {
  const { t } = useTranslation("fw");
  return (
    <>
      <Button asChild data-testid="wallet-locked-cta">
        <Link to={lockCtaTo(lock.step)}>
          <Icon name="users" />
          {t(lock.step === "invite" ? "wallet.locked.inviteCta" : "wallet.locked.registerCta")}
        </Link>
      </Button>
      {onDismiss ? (
        <Button variant="ghost" onClick={onDismiss}>
          {t("wallet.locked.laterCta")}
        </Button>
      ) : null}
    </>
  );
}

/**
 * POPUP ở hub: bấm "Gửi" khi ví chưa mở khoá thì hiện NGAY, không cho vào form.
 * Dialog (Radix) chứ không phải khối inline: đây là chặn đường, phải cắt ngang
 * thao tác và bắt trả lời — khối inline dễ bị lướt qua.
 */
export function WalletLockedDialog({
  lock,
  open,
  onOpenChange,
}: {
  lock: LockedInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("fw");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="wallet-locked-dialog">
        <DialogHeader>
          <DialogTitle>{t("wallet.locked.title")}</DialogTitle>
          <DialogDescription>{t("wallet.locked.intro")}</DialogDescription>
        </DialogHeader>
        <WalletLockedBody lock={lock} />
        <DialogFooter className="sm:flex-col">
          <LockActions lock={lock} onDismiss={() => onOpenChange(false)} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Khối chặn TẠI CHỖ cho màn /wallet/send — người dùng vào thẳng bằng link/bookmark
 * thì không có cú bấm nào để bật popup, mà form vẫn phải không mở ra được.
 */
export function WalletLockedNotice({ lock }: { lock: LockedInfo }) {
  const { t } = useTranslation("fw");
  return (
    <section
      className="flex flex-col gap-4 rounded-card border bg-card p-5"
      data-testid="wallet-locked-notice"
    >
      <div className="flex items-start gap-3">
        <Icon name="lock" size={32} />
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">{t("wallet.locked.title")}</h2>
          <p className="text-copy text-muted-foreground">{t("wallet.locked.intro")}</p>
        </div>
      </div>
      <WalletLockedBody lock={lock} />
      <div className="flex flex-col gap-2">
        <LockActions lock={lock} />
        <Button asChild variant="ghost">
          <Link to="/wallet">{t("wallet.locked.backCta")}</Link>
        </Button>
      </div>
    </section>
  );
}
