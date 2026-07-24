// Ngày giờ đa locale (PHA 7.1) — Intl.DateTimeFormat với locale + timezone
// NGƯỜI XEM tường minh. Timelock/deadline hiện CẢ đếm ngược LẪN mốc tuyệt đối
// (luật i18n §2): "còn 5 giờ" một mình dễ hiểu sai khi notification tới trễ.

export type FormatDateTimeOptions = {
  locale: string;
  /** IANA timezone của NGƯỜI XEM; bỏ trống = timezone máy đang render. */
  timeZone?: string;
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
};

export function formatDateTime(value: Date | string | number, opts: FormatDateTimeOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(opts.locale, {
    dateStyle: opts.dateStyle ?? "medium",
    timeStyle: opts.timeStyle ?? "short",
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  }).format(date);
}

const UNIT_MS = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1_000],
] as const;

/**
 * Đếm ngược "2 ngày 4 giờ" theo locale — tối đa 2 đơn vị lớn nhất, đơn vị
 * localize bằng Intl.NumberFormat style unit (không tự bịa chữ "ngày/day").
 * ms ≤ 0 → chuỗi rỗng (caller tự quyết hiển thị "đã hết" bằng i18n key).
 */
export function formatCountdown(ms: number, locale: string): string {
  if (ms <= 0) return "";
  const parts: string[] = [];
  let rest = ms;
  for (const [unit, size] of UNIT_MS) {
    if (parts.length >= 2) break;
    const count = Math.floor(rest / size);
    if (count === 0 && parts.length === 0 && unit !== "second") continue;
    if (count === 0 && parts.length > 0) continue;
    rest -= count * size;
    parts.push(
      new Intl.NumberFormat(locale, {
        style: "unit",
        unit,
        unitDisplay: "long",
      }).format(count),
    );
  }
  return parts.join(" ");
}

export type TimelockView = {
  /** Đếm ngược đã localize ("2 days 4 hours") — rỗng khi đã hết. */
  countdown: string;
  /** Mốc tuyệt đối theo locale + timezone người xem. */
  absolute: string;
  expired: boolean;
};

/** View timelock đầy đủ — MỘT nguồn cho mọi màn có deadline (recovery, approval…). */
export function timelockView(
  deadline: Date | string | number,
  opts: FormatDateTimeOptions & { now?: Date },
): TimelockView {
  const target = deadline instanceof Date ? deadline : new Date(deadline);
  const now = opts.now ?? new Date();
  const ms = target.getTime() - now.getTime();
  return {
    countdown: formatCountdown(ms, opts.locale),
    absolute: formatDateTime(target, opts),
    expired: ms <= 0,
  };
}
