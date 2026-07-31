// Lô R7 nhóm D — guard TĨNH cho hai lời hứa của các màn chờ.
//
// Đây là tripwire, KHÔNG phải proof: nó đọc mã nguồn chứ không render. Bằng
// chứng hành vi nằm ở `live-countdown.test.tsx` và `initials-avatar.test.tsx`.
// Việc của file này là chặn hai thứ QUAY LẠI sau khi đã gỡ:
//   1. ảnh người thật (`GuardianPortrait` — ảnh stock) trên hai màn người bảo hộ;
//   2. bốn màn chờ trôi ra bốn kiểu đếm ngược khác nhau.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES = join(import.meta.dirname, ".");
const read = (rel: string) => readFileSync(join(ROUTES, rel), "utf8");

/** Hai màn mà người bảo hộ quyết định có trao ví cho một khoá mới hay không. */
const GUARDIAN_DECISION_SCREENS = [
  "_authenticated/guardian/index.tsx",
  "_authenticated/guardian/approve.tsx",
];

/** Bốn màn chờ phải dùng CHUNG một đồng hồ (D3). */
const WAITING_SCREENS = [
  "_authenticated/guardian/index.tsx",
  "_authenticated/guardian/approve.tsx",
  "_authenticated/night-watch/-mirror-request-card.tsx",
  "recovery/countdown.tsx",
];

describe("R7 D1 — không ảnh người thật trên màn quyết định của người bảo hộ", () => {
  for (const file of GUARDIAN_DECISION_SCREENS) {
    it(`${file} không dùng GuardianPortrait (ảnh stock)`, () => {
      const src = read(file);
      expect(src).not.toContain("GuardianPortrait");
      expect(src).not.toContain("guardian-portrait");
      // Không tự dựng <img> thay thế.
      expect(src).not.toContain("<img");
    });

    it(`${file} dùng InitialsAvatar (chữ cái đầu từ chính cái tên đang hiện)`, () => {
      expect(read(file)).toContain("InitialsAvatar");
    });
  }
});

describe("R7 D3 — bốn màn chờ dùng CHUNG một đồng hồ", () => {
  for (const file of WAITING_SCREENS) {
    it(`${file} dùng LiveCountdown`, () => {
      const src = read(file);
      expect(src).toContain("LiveCountdown");
      // `TimelockCountdown` (số tĩnh) chỉ còn được dùng BÊN TRONG LiveCountdown.
      expect(src).not.toContain("<TimelockCountdown");
    });
  }
});
