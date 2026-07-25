// Giải thích CỬA SỔ BẢO VỆ sau khi khôi phục ví.
//
// Vì sao màn này quan trọng hơn vẻ ngoài của nó: người vừa mất điện thoại, vừa
// nhờ được người nhà cứu ví — mở ra thấy "ví bị khoá" không rõ tới bao giờ. Đó
// là khoảnh khắc lo lắng nhất của cả sản phẩm. Ví chối chữ ký ở đây là HÀNH VI
// ĐÚNG (chặn kẻ vừa chiếm được đợt khôi phục rút tiền ngay), nên copy phải nói
// đủ bốn điều: đang bảo vệ · còn bao lâu · vì sao · làm gì được.
import { timelockView } from "@repo/core";
import { useTranslation } from "react-i18next";
import type { ChainCooldown } from "../api/recovery";

export function CooldownNotice({ cooldown }: { cooldown: ChainCooldown }) {
  const { t, i18n } = useTranslation("fw");
  if (!cooldown.active || cooldown.activeUntil === null) return null;

  const view = timelockView(new Date(cooldown.activeUntil * 1000).toISOString(), {
    locale: i18n.language,
  });

  return (
    <section
      className="rounded-md border border-border bg-muted/40 p-3"
      role="status"
      data-testid="cooldown-notice"
    >
      <p className="font-medium text-foreground text-sm">{t("recovery.cooldown.title")}</p>
      <p className="mt-1 text-muted-foreground text-sm">
        {t("recovery.cooldown.remaining", {
          countdown: view.countdown,
          absolute: view.absolute,
        })}
      </p>
      <p className="mt-2 text-muted-foreground text-sm">{t("recovery.cooldown.why")}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground text-sm">
        <li>{t("recovery.cooldown.canDo")}</li>
        <li>{t("recovery.cooldown.cannotDo")}</li>
      </ul>
      <p className="mt-2 text-muted-foreground text-xs">{t("recovery.cooldown.notABug")}</p>
    </section>
  );
}
