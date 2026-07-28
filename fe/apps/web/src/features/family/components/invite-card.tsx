// Thẻ lời mời (§3 luồng chuẩn màn mời) — thứ NGƯỜI DÙNG THẬT SỰ GỬI ĐI.
//
// Trước bản này, tạo lời mời xong không hiện gì (choose-guardians) hoặc chỉ
// hiện link trần cái CUỐI (invite) — người dùng bế tắc ngay bước quyết định
// ví có cứu được hay không. Thẻ này: QR (quét bằng camera máy người thân) +
// link đầy đủ + copy + chia sẻ, và câu nhắc BẮT BUỘC "mở trên máy của họ" —
// guardian tạo passkey CỦA HỌ; mở cả 3 link trên một máy là hỏng cả bộ.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/family/icons";
import { WalletQrCode } from "@/components/family/illustrations";
import { Button } from "@/components/family/ui";
import { inviteAcceptUrl } from "../api/invites";

/** Link hiện rút gọn (token giữa bị cắt) — clipboard luôn nhận bản ĐẦY ĐỦ. */
function shortenUrl(url: string, token: string): string {
  if (token.length <= 12) return url;
  return url.replace(token, `${token.slice(0, 6)}…${token.slice(-4)}`);
}

export function InviteCard({ label, token }: { label: string; token: string }) {
  const { t } = useTranslation("fw");
  const [copied, setCopied] = useState(false);
  const url = inviteAcceptUrl(token);
  // Không hỗ trợ Web Share API → ẨN nút, không hiện nút chết.
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Trình duyệt cũ / webview không cấp clipboard API → fallback execCommand.
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t("setup.invite.card.copiedToast"));
  }

  async function share() {
    try {
      await navigator.share({
        title: t("setup.invite.title"),
        text: t("setup.invite.card.hint"),
        url,
      });
    } catch {
      // Người dùng đóng hộp chia sẻ — không phải lỗi, không toast.
    }
  }

  return (
    <div
      data-testid="invite-card"
      className="flex flex-col items-center gap-3 rounded-card border border-dashed bg-card p-4"
    >
      <p className="font-semibold text-foreground">{label}</p>
      {/* Hộp trắng + padding = quiet zone đủ cho máy quét (cùng khuôn màn Nhận). */}
      <div className="rounded-card border bg-white p-3 shadow-sm">
        <WalletQrCode
          value={url}
          label={t("setup.invite.card.qrLabel", { label })}
          className="size-52"
        />
      </div>
      <code className="break-all text-center text-muted-foreground text-xs">
        {shortenUrl(url, token)}
      </code>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void copy()}>
          <Icon name={copied ? "checkCircle" : "copy"} />
          {copied ? t("wallet.receive.copied") : t("setup.invite.copyCta")}
        </Button>
        {canShare ? (
          <Button size="sm" variant="outline" onClick={() => void share()}>
            {t("setup.invite.card.shareCta")}
          </Button>
        ) : null}
      </div>
      <p className="text-center text-muted-foreground text-xs">{t("setup.invite.card.hint")}</p>
      <p className="text-center text-muted-foreground text-xs">{t("setup.invite.card.expiry")}</p>
    </div>
  );
}
