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

  // autoSignInAfterVerification → getSession → defaultPanelPath("user") = "/".
  await expect(page).toHaveURL("http://localhost:4174/");
});

test("verify-email without an email param redirects to sign-up", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/verify-email");
  await expect(page).toHaveURL(/\/sign-up$/);
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
