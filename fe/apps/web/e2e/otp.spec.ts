import { expect, type Page, test } from "@playwright/test";

// OTP flows (email verification after sign-up + forgot/reset password) run
// against mocked Better Auth — no backend. Better Auth client calls `/api/auth/*`
// over @better-fetch; any 2xx JSON = success (error null). We stub the namespace.
const USER = {
  user: {
    id: "u1",
    email: "user@example.com",
    name: "Test User",
    emailVerified: true,
    role: "user",
  },
  session: { id: "s1", userId: "u1" },
};

async function mockAuth(page: Page) {
  await page.route("**/api/auth/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      // Superset body: covers sign-up ({user}), verify/reset ({status,token,user,success}),
      // and get-session ({user,session}). Extra keys are ignored by the client.
      body: JSON.stringify({ ...USER, status: true, success: true, token: "tok" }),
    }),
  );
}

// input-otp renders ONE real <input> (6 ô chỉ là div). Chọn nó bằng
// `data-input-otp` — attribute của chính primitive.
// KHÔNG dùng [data-slot="input-otp"]: shadcn <FormControl> là Radix Slot, nó
// GHI ĐÈ data-slot của child thành "form-control" → selector đó không tồn tại.
async function fillOtp(page: Page, code: string) {
  await page.locator("input[data-input-otp]").fill(code);
}

test("sign-up redirects to verify-email carrying the email", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/sign-up");
  await page.getByLabel("Tên").fill("Test User");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Mật khẩu").fill("SuperSecret123!");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await expect(page).toHaveURL(/\/verify-email\?email=user%40example\.com$/);
});

test("verify-email accepts the OTP and lands in the app", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/verify-email?email=user@example.com");
  await fillOtp(page, "123456");
  await page.getByRole("button", { name: "Xác minh" }).click();

  // autoSignInAfterVerification → getSession → postAuthPath("user") = "/wallet".
  await expect(page).toHaveURL(/\/wallet$/);
});

test("verify-email without an email param redirects to sign-up", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/verify-email");
  await expect(page).toHaveURL(/\/sign-up$/);
});

// A.4.3 (28/07): người thân mở link mời guardian đa số CHƯA có tài khoản.
// ?redirect phải sống qua CẢ chuỗi đăng ký → OTP, không được rơi về /wallet.
test("sign-up với ?redirect giữ token qua OTP — về đúng trang nhận lời mời", async ({ page }) => {
  await mockAuth(page);
  await page.route("**/api/guardians/invites/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          label: "Mẹ",
          owner_name: "Chủ Ví",
          status: "sent",
          usable: true,
          expires_at: "2027-01-01T00:00:00Z",
        },
      }),
    }),
  );

  await page.goto("/sign-up?redirect=%2Fguardian%2Faccept%3Ftoken%3Dtok1");
  await page.getByLabel("Tên").fill("Test User");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByLabel("Mật khẩu").fill("SuperSecret123!");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  // redirect đi kèm qua trang verify…
  await expect(page).toHaveURL(/\/verify-email\?.*redirect=/);
  await fillOtp(page, "123456");
  await page.getByRole("button", { name: "Xác minh" }).click();

  // …và OTP xong quay về ĐÚNG trang nhận lời mời, không rơi về /wallet.
  await expect(page).toHaveURL(/\/guardian\/accept\?token=tok1/);
});

// Trang nhận lời mời giờ CÔNG KHAI: chưa đăng nhập phải thấy GIẢI THÍCH,
// không bị đá thẳng vào ô mật khẩu (hình dạng phishing — bug A 28/07).
test("mở link mời khi CHƯA đăng nhập → thấy trang giải thích, không nhảy vào /login", async ({
  page,
}) => {
  // KHÔNG mockAuth session — get-session trả null như người lạ thật.
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
  );
  await page.route("**/api/config/validation", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    }),
  );
  await page.route("**/api/guardians/invites/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          label: "Mẹ",
          owner_name: "Chủ Ví",
          status: "sent",
          usable: true,
          expires_at: "2027-01-01T00:00:00Z",
        },
      }),
    }),
  );

  await page.goto("/guardian/accept?token=tok1");
  // Vẫn Ở NGUYÊN trang accept — không bị guard đá sang /login.
  await expect(page).toHaveURL(/\/guardian\/accept\?token=tok1/);
  // Có tên người mời + nút đồng ý dẫn sang đăng nhập (giữ redirect).
  await expect(page.getByText(/Chủ Ví/)).toBeVisible();
  await expect(page.getByTestId("guardian-accept-login")).toBeVisible();
});

test("forgot-password redirects to reset-password carrying the email", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("user@example.com");
  await page.getByRole("button", { name: "Gửi mã" }).click();

  await expect(page).toHaveURL(/\/reset-password\?email=user%40example\.com$/);
});

test("reset-password with OTP + new password redirects to login", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/reset-password?email=user@example.com");
  await fillOtp(page, "123456");
  await page.getByLabel("Mật khẩu mới").fill("BrandNewSecret456!");
  await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test("reset-password without an email param redirects to forgot-password", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/forgot-password$/);
});
