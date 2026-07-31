// Lô R7 (D3) — ĐỒNG HỒ CHẠY THẬT cho mọi màn chờ.
//
// Trước lô này các màn chờ hiện một con số TĨNH ("15 giờ 21 phút") dựng lúc
// render rồi đứng im tới lần refetch sau; `/guardian` và `/guardian/approve`
// thì không có số nào cả, chỉ nói "đang chờ hết khoảng an toàn". Người đang
// chờ xem ví mình có bị chiếm không cần biết CÒN BAO LÂU, và cần thấy nó
// đang chạy — một con số đứng yên đọc như app đã treo.
//
// Đây là MỘT component cho cả bốn màn chờ (`/guardian`, `/guardian/approve`,
// `/night-watch`, `/recovery/countdown`) để đồng hồ ở mọi nơi giống hệt nhau:
// bốn cách hiển thị thời gian còn lại là bốn cơ hội nói lệch nhau.
//
// ⚠️ Mốc `vetoUntil` là ƯỚC LƯỢNG theo đồng hồ BE (mirror ghi
// `now + timelock_secs` lúc indexer đọc được event, không phải `started_at` của
// contract) — đồng hồ này có thể lệch mốc thật vài phút. Nợ đã ghi từ lô trước,
// KHÔNG sửa trong lô này.
import { formatDateTime } from "@repo/core";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TimelockCountdown } from "./timelock-countdown";

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/**
 * `ms` còn lại → `HH : MM : SS`. Hết giờ (hoặc âm) → `00 : 00 : 00`.
 *
 * Giờ KHÔNG cuộn về 0 sau 24 — cửa sổ chặn có thể dài 3 ngày, hiện "01 : 05 : 00"
 * cho 25 giờ là nói dối theo hướng nguy hiểm nhất (người ta tưởng còn 1 tiếng).
 * Không đi qua Intl: đây là chữ số, không phải chữ — cùng một mặt đồng hồ ở cả
 * ba ngôn ngữ.
 */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "00 : 00 : 00";
  const total = Math.floor(ms / 1000);
  return `${pad(total / 3600)} : ${pad((total % 3600) / 60)} : ${pad(total % 60)}`;
}

export function LiveCountdown({
  deadline,
  label,
  large = false,
}: {
  /** Mốc hết hạn (ISO string / Date / epoch ms). */
  deadline: string | Date | number;
  /** Nhãn nhỏ phía trên khi đồng hồ CÒN chạy. Hết giờ thì bị thay. */
  label?: string | undefined;
  large?: boolean | undefined;
}) {
  const { t, i18n } = useTranslation("fw");
  const target = deadline instanceof Date ? deadline : new Date(deadline);
  const targetMs = target.getTime();
  const [remaining, setRemaining] = useState(() => targetMs - Date.now());

  useEffect(() => {
    // Nhịp giây. Tính lại từ `Date.now()` mỗi nhịp thay vì trừ dần 1000 — tab bị
    // trình duyệt bóp nhịp (nền, tiết kiệm pin) thì đồng hồ vẫn đúng khi quay lại,
    // chứ không chậm dần mãi mãi. Dep là SỐ (không phải object Date mới mỗi
    // render) nên interval không bị dựng lại vô ích.
    const tick = () => setRemaining(targetMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const expired = remaining <= 0;
  return (
    <div data-testid="live-countdown" data-expired={expired ? "true" : "false"}>
      <TimelockCountdown
        countdown={formatClock(remaining)}
        absolute={formatDateTime(target, { locale: i18n.language })}
        label={expired ? t("countdown.windowClosed") : label}
        large={large}
      />
    </div>
  );
}
