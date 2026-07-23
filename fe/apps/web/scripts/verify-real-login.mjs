// Bằng chứng PHẦN 3.2 — ĐĂNG NHẬP THẬT TỪ TRÌNH DUYỆT, KHÔNG mock.
//
// Khác với `apps/web/e2e/*.spec.ts` (hermetic: page.route stub /api/auth/** nên
// chạy được khi không có backend), script này mở Chromium THẬT vào FE dev server
// và để nó gọi BE THẬT — chứng minh wiring cookie/CORS/CSRF/TRUSTED_ORIGINS đúng.
//
// Chạy: BE `bun run dev` (:3000) + FE `pnpm dev:web` (:5173) rồi
//   node apps/web/scripts/verify-real-login.mjs   (chạy từ root repo)
import { chromium } from "@playwright/test";

const FE = process.env.FE_URL ?? "http://localhost:5173";
const BE = process.env.BE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SEED_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "admin123456789";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// channel "chromium" = bản Chromium ĐẦY ĐỦ. Mặc định Playwright dùng
// chrome-headless-shell, mà bản đó trên máy này thiếu libnspr4/libnss3/libasound
// (cài được bằng `sudo npx playwright install-deps` — máy dev chưa có sudo).
// Bản đầy đủ `ldd` sạch nên chạy được ngay. Đây là KI-2 fail-env, không phải lỗi code.
const browser = await chromium.launch({ channel: "chromium" });
// locale en: sản phẩm toàn cầu, en là mặc định (i18n detect qua navigator).
const context = await browser.newContext({ locale: "en-US" });
const page = await context.newPage();

const apiCalls = [];
page.on("response", (r) => {
  if (r.url().startsWith(BE)) apiCalls.push({ url: r.url(), status: r.status() });
});
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});

try {
  // 1. FE render được (thiếu .env = TRANG TRẮNG không báo lỗi — BUG-007).
  await page.goto(`${FE}/login`, { waitUntil: "networkidle" });
  const rootHtml = await page.locator("#root").innerHTML();
  check(
    "FE render (#root không rỗng — .env đã có)",
    rootHtml.trim().length > 0,
    `${rootHtml.length} ký tự`,
  );

  // 2. FE gọi được BE lúc boot (GET /api/config/validation — D-052).
  const limits = apiCalls.find((c) => c.url.includes("/api/config/validation"));
  check(
    "FE→BE /api/config/validation",
    limits?.status === 200,
    `HTTP ${limits?.status ?? "không gọi"}`,
  );

  // 3. ĐĂNG NHẬP THẬT: điền form, submit, BE trả cookie thật.
  // Scope vào <form>: devtools panel của TanStack Router cũng có aria-label
  // chứa "email" → getByLabel toàn trang vi phạm strict mode.
  const form = page.locator("form").first();
  await form.locator('input[type="email"]').fill(EMAIL);
  await form.locator('input[type="password"]').fill(PASSWORD);
  const signInResponse = page.waitForResponse(
    (r) => r.url().includes("/api/auth/sign-in/email") && r.request().method() === "POST",
  );
  await form.locator('button[type="submit"]').click();
  const signIn = await signInResponse;
  check("POST /api/auth/sign-in/email", signIn.status() === 200, `HTTP ${signIn.status()}`);

  // 4. Cookie session ĐƯỢC SET (chứng minh TRUSTED_ORIGINS/CORS credentials đúng).
  const cookies = await context.cookies();
  const sessionCookie = cookies.find((c) => c.name.includes("session"));
  check(
    "Cookie session được set trong trình duyệt",
    Boolean(sessionCookie),
    sessionCookie?.name ?? "không có",
  );

  // 5. Điều hướng sang route được bảo vệ → guard cho qua (session thật).
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
  check("Redirect khỏi /login sau đăng nhập", true, page.url());

  await page.goto(`${FE}/dashboard`, { waitUntil: "networkidle" });
  check("Vào được route bảo vệ /dashboard", page.url().includes("/dashboard"), page.url());

  // 6. Panel admin (role admin từ seed:admin) — guard requireRoles cho qua.
  await page.goto(`${FE}/admin`, { waitUntil: "networkidle" });
  check("Vào được /admin (requireRoles admin)", page.url().includes("/admin"), page.url());

  // 7. Màn hình FamilyWallet mới render (i18n key resolve, không lộ raw key).
  await page.goto(`${FE}/welcome`, { waitUntil: "networkidle" });
  const welcomeText = await page.locator("body").innerText();
  check(
    "Màn /welcome render chuỗi i18n (không lộ raw key)",
    welcomeText.includes("FamilyWallet") && !welcomeText.includes("welcome.title"),
    welcomeText.split("\n")[0]?.slice(0, 60),
  );

  // 8. Không có lỗi console (trừ nhiễu devtools/HMR).
  const realErrors = consoleErrors.filter(
    (e) => !e.includes("Download the React DevTools") && !e.includes("[vite]"),
  );
  check("Không có lỗi console", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));
} finally {
  await browser.close();
}

console.log("\n--- Tóm tắt request tới BE ---");
for (const c of apiCalls) console.log(`  ${c.status}  ${c.url.replace(BE, "")}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} check PASS`);
process.exit(failed.length === 0 ? 0 : 1);
