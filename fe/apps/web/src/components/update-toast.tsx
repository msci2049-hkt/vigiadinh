import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// SW tự check update khi navigate/reload; tab mở lâu thì check theo chu kỳ này
// để deploy mới không bị "im lặng" tới khi user tự F5.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * D-052: khi SW phát hiện bản deploy mới (registerType "prompt" → SW mới đứng
 * chờ), hiện toast "Có phiên bản mới — Tải lại". KHÔNG có nó, user với tab cũ
 * gặp asset 404 sẽ tưởng app hỏng và đội sẽ debug nhầm chỗ (đã xảy ra).
 * `updateServiceWorker(true)` = skipWaiting + reload — user chủ động bấm.
 */
export function UpdateToast() {
  const { t } = useTranslation("common");
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast(t("update.available"), {
      id: "sw-update", // dedup: interval check không spam toast mới
      duration: Number.POSITIVE_INFINITY, // đứng tới khi user quyết định
      action: {
        label: t("update.reload"),
        onClick: () => void updateServiceWorker(true),
      },
    });
  }, [needRefresh, t, updateServiceWorker]);

  return null;
}
