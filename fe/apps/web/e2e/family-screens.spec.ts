// E2e KHÔNG cần backend (PHA 2.2 + 2.3): mock session + guardians + inheritance
// plan qua page.route rồi assert các màn night-watch + inheritance/claim render
// đúng DỮ LIỆU (không phải stub). Chạy mọi browser — không chạm mạng.
import { expect, type Page, test } from "@playwright/test";

const SESSION = {
  user: {
    id: "u1",
    email: "owner@example.com",
    name: "Owner",
    emailVerified: true,
    role: "user",
    banned: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  session: { id: "s1", userId: "u1", token: "tok", expiresAt: "2027-01-01T00:00:00Z" },
};

const WALLET = {
  id: "w1",
  userId: "u1",
  familyId: null,
  timezone: "UTC",
  stellarAddress: "CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7",
  contractId: "CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7",
  threshold: 2,
  timelockSecs: 0,
  createdAt: "2026-07-24T00:00:00Z",
};

const GUARDIANS = [
  {
    id: "g1",
    walletId: "w1",
    userId: null,
    onchainKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST",
    status: "active",
    lastSeenAt: "2026-07-24T10:00:00Z",
    lastManualConfirmAt: null,
    createdAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "g2",
    walletId: "w1",
    userId: null,
    onchainKey: "GXYZ0000000000000000000000000000000000000000000000WXYZ",
    status: "offline",
    lastSeenAt: "2026-07-18T10:00:00Z",
    lastManualConfirmAt: null,
    createdAt: "2026-07-01T00:00:00Z",
  },
];

const PLAN = {
  id: "p1",
  version: 1,
  inactivityPeriodSecs: 2_592_000, // 30 ngày
  finalTimelockSecs: 604_800, // 7 ngày
  status: "active",
  escalationTier: 0,
  updatedAt: "2026-07-24T00:00:00Z",
};

// Một yêu cầu khôi phục ĐANG MỞ trên ví mình bảo hộ (cho hộp thư guardian).
const INBOX = [
  {
    request: {
      id: "r1",
      walletId: "w1",
      newOwner: "abc123fingerprint",
      status: "pending",
      riskScore: null,
      approvals: 0,
      threshold: 2,
      txHash: null,
      vetoUntil: null,
      startedAt: "2026-07-24T14:00:00Z",
      expiresAt: null,
    },
    wallet: { id: "w1", stellarAddress: WALLET.stellarAddress, threshold: 2, timelockSecs: 0 },
  },
];

async function mockBackend(page: Page): Promise<void> {
  await page.route("**/api/auth/get-session", (r) => r.fulfill({ json: SESSION }));
  await page.route("**/api/config/validation", (r) => r.fulfill({ json: { data: {} } }));
  await page.route("**/api/wallets", (r) => r.fulfill({ json: { data: [WALLET] } }));
  await page.route("**/api/guardians/wallet/**", (r) => r.fulfill({ json: { data: GUARDIANS } }));
  await page.route("**/api/recovery/wallet/**", (r) => r.fulfill({ json: { data: [] } }));
  // Playwright: route đăng ký SAU thắng → route cụ thể phải sau route rộng.
  await page.route("**/api/recovery/guardian/device-requests", (r) =>
    r.fulfill({ json: { data: [] } }),
  );
  await page.route("**/api/recovery/guardian", (r) => r.fulfill({ json: { data: INBOX } }));
  await page.route("**/api/inheritance/wallet/**", (r) => r.fulfill({ json: { data: [] } }));
  await page.route("**/api/inheritance/wallet/*/plan", (r) => r.fulfill({ json: { data: PLAN } }));
}

test.describe("night-watch + inheritance screens (mocked BE)", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  // locale pin vi-VN (playwright.config) → assert bằng tiếng Việt.
  test("night-watch center → alert lists the unreachable protector", async ({ page }) => {
    await page.goto("/night-watch");
    // Một người offline → nút xử lý hiện, bấm sang alert.
    await page.getByRole("link", { name: "Tôi làm gì được?" }).click();
    await expect(page).toHaveURL(/\/night-watch\/alert/);
    // Người offline (g2) hiện với khoá rút gọn; người active (g1) KHÔNG nằm danh sách.
    await expect(page.getByText("GXYZ00…WXYZ")).toBeVisible();
    // "Mất liên lạc" cũng nằm trong tiêu đề → chỉ đếm badge (exact) để tránh strict-mode.
    await expect(page.getByText("Mất liên lạc", { exact: true })).toBeVisible();
  });

  test("alert → resolve → waiting flow", async ({ page }) => {
    await page.goto("/night-watch/alert");
    await page.getByRole("link", { name: "Tôi làm gì được?" }).click();
    await expect(page).toHaveURL(/\/night-watch\/resolve/);
    await page.getByRole("link", { name: "Đã nhắn họ — chờ kết nối lại" }).click();
    await expect(page).toHaveURL(/\/night-watch\/waiting/);
    await expect(page.getByText("GXYZ00…WXYZ")).toBeVisible();
  });

  test("guardian-view shows own active status", async ({ page }) => {
    await page.goto("/night-watch/guardian-view");
    await expect(page.getByText("Đang hoạt động — bạn liên lạc được")).toBeVisible();
  });

  test("inheritance claim shows stages from the real plan config", async ({ page }) => {
    await page.goto("/inheritance/claim");
    // 30 ngày im lặng + 7 ngày cửa sổ cuối render từ PLAN (xuất hiện ≥1 chỗ).
    await expect(page.getByText(/30 ngày/).first()).toBeVisible();
    await expect(page.getByText(/7 ngày/).first()).toBeVisible();
    // Tier 0 → trạng thái khoẻ.
    await expect(page.getByText(/Bạn vừa điểm danh/)).toBeVisible();
  });

  test("mức-B wizard stub is honest — labels the step + exits to the working setup", async ({
    page,
  }) => {
    await page.goto("/setup/choose-guardians");
    await expect(page.getByRole("heading", { name: "Chọn người bảo hộ" })).toBeVisible();
    // Không giả vờ chạy: có lối ra RÕ về mức A đang chạy.
    await page.getByRole("link", { name: "Thiết lập ví của tôi" }).click();
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("guardian inbox → rule-based warning (not AI) before approving", async ({ page }) => {
    await page.goto("/guardian");
    await page.getByRole("link", { name: "Xem yêu cầu này" }).click();
    await expect(page).toHaveURL(/\/guardian\/approve-warning/);
    // Nhãn RÕ "theo quy tắc — không phải AI".
    await expect(page.getByText("Cảnh báo theo quy tắc — không phải AI")).toBeVisible();
    // Cảnh báo newKey luôn kích (khôi phục cài khoá mới).
    await expect(page.getByText(/trao ví cho một khoá mới toanh/)).toBeVisible();
    // Luật 6: vẫn có đường sang màn duyệt thật (cảnh báo chỉ nhắc, không chặn).
    await expect(page.getByRole("link", { name: "Tôi đã xác minh — xem và duyệt" })).toBeVisible();
  });
});
