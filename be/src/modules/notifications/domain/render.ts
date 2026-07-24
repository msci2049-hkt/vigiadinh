// Render ICU theo locale NGƯỜI NHẬN (PHA 4.3). Fallback: locale thiếu → en;
// template lạ → bản generic an toàn (KHÔNG throw giữa đường gửi — thông báo xấu
// còn hơn im lặng nuốt sự kiện an ninh).
import { IntlMessageFormat } from "intl-messageformat";
import { logger } from "@/lib/logger";
import { TEMPLATES } from "./templates";

const DEFAULT_LOCALE = "en";

const GENERIC: Record<string, { title: string; body: string }> = {
  en: {
    title: "Wallet update",
    body: "Something changed in your family wallet. Open the app for details.",
  },
  vi: {
    title: "Cập nhật ví",
    body: "Ví gia đình của bạn có thay đổi. Mở ứng dụng để xem chi tiết.",
  },
};

export type RenderedNotification = { title: string; body: string; locale: string };

export function renderNotification(
  templateKey: string,
  locale: string,
  params: Record<string, unknown> | null,
): RenderedNotification {
  const lang = (locale.split("-")[0] ?? DEFAULT_LOCALE).toLowerCase();
  const perLocale = TEMPLATES[templateKey];
  if (!perLocale) {
    logger.warn({ templateKey }, "notify.template-missing");
    const generic = GENERIC[lang] ?? GENERIC[DEFAULT_LOCALE];
    if (!generic) throw new Error("NOTIFY_GENERIC_MISSING");
    return { ...generic, locale: lang };
  }
  const template = perLocale[lang] ?? perLocale[DEFAULT_LOCALE];
  if (!template) throw new Error(`NOTIFY_TEMPLATE_NO_LOCALE:${templateKey}`);
  const usedLocale = perLocale[lang] ? lang : DEFAULT_LOCALE;
  try {
    const title = new IntlMessageFormat(template.title, usedLocale).format(params ?? {});
    const body = new IntlMessageFormat(template.body, usedLocale).format(params ?? {});
    return { title: String(title), body: String(body), locale: usedLocale };
  } catch (err) {
    // Params lệch ICU (thiếu biến plural...) — log + generic, không chết worker.
    logger.warn({ err, templateKey, locale: usedLocale }, "notify.render-failed");
    const generic = GENERIC[usedLocale] ?? GENERIC[DEFAULT_LOCALE];
    if (!generic) throw new Error("NOTIFY_GENERIC_MISSING");
    return { ...generic, locale: usedLocale };
  }
}
