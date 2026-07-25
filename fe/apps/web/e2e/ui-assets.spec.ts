/// <reference lib="dom" />

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const APP_ORIGIN = "http://localhost:4174";
const CONTRACT_ADDRESS = "CBWLUXGFB7IL4FIU3UFA2RV4J6Q3QJYKAPL2H4VF774JIBYLZUWAE5A7";
const TX_HASH = "a".repeat(64);

const ROUTES = [
  "/welcome",
  "/get-started",
  "/passkey",
  "/recovery",
  "/recovery/find-wallet",
  `/recovery/sent?address=${CONTRACT_ADDRESS}`,
  `/recovery/progress?address=${CONTRACT_ADDRESS}`,
  `/recovery/countdown?address=${CONTRACT_ADDRESS}`,
  `/recovery/done?address=${CONTRACT_ADDRESS}`,
  "/setup",
  "/setup/assistant",
  "/setup/choose-guardians",
  "/setup/invite",
  "/setup/threshold",
  "/setup/timelock",
  "/setup/review",
  "/setup/done",
  "/wallet",
  "/wallet/send",
  "/wallet/receive",
  "/wallet/history",
  "/guardians",
  "/guardians/g1",
  "/night-watch",
  "/night-watch/log",
  "/night-watch/alert",
  "/night-watch/resolve",
  "/night-watch/waiting",
  "/night-watch/guardian-view",
  "/guardian",
  "/guardian/approve?wallet=w1",
  "/guardian/approve-warning?wallet=w1",
  `/guardian/approved?tx=${TX_HASH}`,
  "/guardian/accept?token=asset-audit-token",
  "/guardian/initiate?wallet=w1",
  "/block",
  "/block/confirm",
  `/block/done?tx=${TX_HASH}`,
  "/inheritance",
  "/inheritance/heartbeat",
  "/inheritance/claim",
] as const;

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
  session: {
    id: "s1",
    userId: "u1",
    token: "asset-audit-session",
    expiresAt: "2027-01-01T00:00:00Z",
  },
};

const WALLET = {
  id: "w1",
  userId: "u1",
  familyId: null,
  timezone: "Asia/Ho_Chi_Minh",
  stellarAddress: CONTRACT_ADDRESS,
  contractId: CONTRACT_ADDRESS,
  threshold: 2,
  timelockSecs: 604_800,
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

const OPEN_REQUEST = {
  id: "r1",
  walletId: "w1",
  newOwner: "abc123fingerprint",
  status: "pending",
  riskScore: null,
  approvals: 1,
  threshold: 2,
  txHash: null,
  vetoUntil: "2026-07-26T14:00:00Z",
  startedAt: "2026-07-24T14:00:00Z",
  expiresAt: null,
};

const INBOX = [
  {
    request: OPEN_REQUEST,
    wallet: {
      id: "w1",
      stellarAddress: CONTRACT_ADDRESS,
      threshold: 2,
      timelockSecs: 604_800,
    },
  },
];

const DEVICE_REQUESTS = [
  {
    deviceRequest: {
      id: "device-1",
      walletId: "w1",
      verifier: CONTRACT_ADDRESS,
      keyBase64: "AQIDBA==",
      fingerprint: "AB12-CD34-EF56",
      status: "pending",
      createdAt: "2026-07-24T14:00:00Z",
    },
    wallet: { id: "w1", stellarAddress: CONTRACT_ADDRESS },
  },
];

const PLAN = {
  id: "p1",
  version: 1,
  inactivityPeriodSecs: 2_592_000,
  finalTimelockSecs: 604_800,
  status: "active",
  escalationTier: 0,
  updatedAt: "2026-07-24T00:00:00Z",
};

const JSON_HEADERS = {
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
  "access-control-allow-origin": APP_ORIGIN,
  "content-type": "application/json",
};

type NetworkFailure = {
  method: string;
  resourceType: string;
  status: number | "request-failed";
  url: string;
};

type DomAudit = {
  imageCount: number;
  svgCount: number;
  brokenImages: string[];
  tinyImages: string[];
  malformedSvgs: string[];
  fontFailures: string[];
};

type RouteResult = DomAudit & {
  route: string;
  appConsoleErrors: string[];
  pageErrors: string[];
  networkFailures: NetworkFailure[];
  navigationErrors: string[];
};

function json(data: unknown) {
  return {
    body: JSON.stringify(data),
    headers: JSON_HEADERS,
    status: 200,
  };
}

async function mockBackend(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === "/api/auth/get-session") {
      await route.fulfill(json(SESSION));
      return;
    }
    if (pathname === "/api/config/validation") {
      await route.fulfill(json({ data: {} }));
      return;
    }
    if (pathname === "/api/wallets") {
      await route.fulfill(json({ data: [WALLET] }));
      return;
    }
    if (pathname.startsWith("/api/guardians/wallet/")) {
      await route.fulfill(json({ data: GUARDIANS }));
      return;
    }
    if (pathname.startsWith("/api/guardians/invites/wallet/")) {
      await route.fulfill(
        json({
          data: {
            invites: [],
            recoverability: { available: 0, threshold: 2, recoverable: false, missing: 2 },
          },
        }),
      );
      return;
    }
    if (pathname.startsWith("/api/guardians/invites/") && request.method() === "GET") {
      await route.fulfill(json({ data: { label: "Mẹ", status: "sent" } }));
      return;
    }
    if (pathname === "/api/recovery/guardian/device-requests") {
      await route.fulfill(json({ data: DEVICE_REQUESTS }));
      return;
    }
    if (pathname === "/api/recovery/guardian") {
      await route.fulfill(json({ data: INBOX }));
      return;
    }
    if (pathname.startsWith("/api/recovery/wallet/")) {
      await route.fulfill(json({ data: [OPEN_REQUEST] }));
      return;
    }
    if (pathname.startsWith("/api/recovery/chain-truth/")) {
      await route.fulfill(
        json({
          data: {
            registered: true,
            cooldown: { active: false, activeUntil: null, cooldownSecs: 0 },
            config: {
              guardians: GUARDIANS.map((guardian) => guardian.onchainKey),
              threshold: 2,
              timelockSecs: 604_800,
            },
            request: {
              status: "pending",
              approvals: [GUARDIANS[0]?.onchainKey],
              startedAt: 1_753_363_200,
              timelockRemainingSecs: 86_400,
            },
          },
        }),
      );
      return;
    }
    if (pathname === "/api/recovery/public/progress") {
      await route.fulfill(
        json({
          data: {
            status: "ready",
            approvals: 2,
            threshold: 2,
            vetoUntil: "2026-07-26T14:00:00Z",
            startedAt: "2026-07-24T14:00:00Z",
          },
        }),
      );
      return;
    }
    if (pathname.endsWith("/plan") && pathname.startsWith("/api/inheritance/wallet/")) {
      await route.fulfill(json({ data: PLAN }));
      return;
    }
    if (pathname.startsWith("/api/inheritance/wallet/")) {
      await route.fulfill(
        json({
          data: [
            {
              id: "h1",
              walletId: "w1",
              heirRef: GUARDIANS[0]?.onchainKey,
              bps: 10_000,
              createdAt: "2026-07-01T00:00:00Z",
            },
          ],
        }),
      );
      return;
    }
    if (pathname.startsWith("/api/audit/wallet/")) {
      await route.fulfill(json({ data: [] }));
      return;
    }
    if (pathname === "/api/intents/send/prepare") {
      const recipient = `G${"A".repeat(55)}`;
      await route.fulfill(
        json({
          data: {
            intentId: "intent-layout-audit",
            status: "prepared",
            from: CONTRACT_ADDRESS,
            recipient,
            amount: "10000000",
            balance: "1000000000",
          },
        }),
      );
      return;
    }

    await route.fulfill({
      body: JSON.stringify({ error: { code: "UNMOCKED_ASSET_AUDIT_API", pathname } }),
      headers: JSON_HEADERS,
      status: 501,
    });
  });
}

function cleanUrl(value: string): string {
  return value.replace(APP_ORIGIN, "");
}

function rowIssues(result: RouteResult): string[] {
  return [
    ...result.navigationErrors.map((error) => `navigation: ${error}`),
    ...result.networkFailures.map(
      (failure) =>
        `network ${failure.status}: ${failure.method} ${cleanUrl(failure.url)} (${failure.resourceType})`,
    ),
    ...result.appConsoleErrors.map((error) => `console: ${error}`),
    ...result.pageErrors.map((error) => `pageerror: ${error}`),
    ...result.brokenImages.map((src) => `broken image: ${cleanUrl(src)}`),
    ...result.tinyImages.map((src) => `1px image: ${cleanUrl(src)}`),
    ...result.malformedSvgs.map((svg) => `malformed SVG: ${svg}`),
    ...result.fontFailures.map((font) => `font: ${font}`),
  ];
}

function reportMarkdown(results: RouteResult[]): string {
  const issues = results.flatMap((result) =>
    rowIssues(result).map((detail) => ({ route: result.route, detail })),
  );
  const totalImages = results.reduce((sum, result) => sum + result.imageCount, 0);
  const totalSvgs = results.reduce((sum, result) => sum + result.svgCount, 0);
  const table = results
    .map((result, index) => {
      const routeIssues = rowIssues(result);
      return `| ${index + 1} | \`${result.route}\` | ${result.imageCount} | ${result.svgCount} | ${routeIssues.length === 0 ? "PASS" : `FAIL (${routeIssues.length})`} |`;
    })
    .join("\n");
  const detail =
    issues.length === 0
      ? "Không phát hiện response >=400, lỗi console cùng origin, ảnh vỡ/1×1, SVG rỗng hoặc font chưa tải."
      : issues.map((issue) => `- \`${issue.route}\` — ${issue.detail}`).join("\n");

  return `# UI Asset Runtime Report — VíGiaĐình

Ngày chạy: 2026-07-25

Lệnh chuẩn: \`corepack pnpm test:assets\`

Phạm vi: đúng ${ROUTES.length} route sản phẩm, Chromium production build, API được mock cục bộ.

## Kết quả

- Route đã mở: ${results.length}/${ROUTES.length}
- Route sạch: ${results.filter((result) => rowIssues(result).length === 0).length}/${ROUTES.length}
- Tổng lượt \`<img>\` đã decode: ${totalImages}
- Tổng lượt SVG đã kiểm tra cấu trúc: ${totalSvgs}
- Tổng lỗi: ${issues.length}

Listener response/console/pageerror/requestfailed được gắn trước lần \`goto\` đầu tiên. Bộ dò chờ \`document.fonts.ready\`, không dùng \`networkidle\`.

| # | Route | Ảnh | SVG | Kết quả |
|---:|---|---:|---:|---|
${table}

## Chi tiết lỗi

${detail}
`;
}

test("41 product routes have healthy runtime assets", async ({ page }) => {
  test.setTimeout(180_000);
  expect(ROUTES).toHaveLength(41);

  await mockBackend(page);

  const results: RouteResult[] = ROUTES.map((route) => ({
    route,
    imageCount: 0,
    svgCount: 0,
    brokenImages: [],
    tinyImages: [],
    malformedSvgs: [],
    fontFailures: [],
    appConsoleErrors: [],
    pageErrors: [],
    networkFailures: [],
    navigationErrors: [],
  }));
  let activeResult = results[0] as RouteResult;

  page.on("response", (response) => {
    if (response.status() < 400) return;
    activeResult.networkFailures.push({
      method: response.request().method(),
      resourceType: response.request().resourceType(),
      status: response.status(),
      url: response.url(),
    });
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    activeResult.networkFailures.push({
      method: request.method(),
      resourceType: request.resourceType(),
      status: "request-failed",
      url: request.url(),
    });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    if (source && new URL(source).origin === APP_ORIGIN) {
      activeResult.appConsoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    activeResult.pageErrors.push(error.message);
  });

  for (const result of results) {
    activeResult = result;
    try {
      await page.goto(result.route, { waitUntil: "domcontentloaded" });
      await page.locator(".product-screen").waitFor({ state: "visible", timeout: 8_000 });
      await page.waitForTimeout(150);
      const dom = await page.evaluate(async (): Promise<DomAudit> => {
        const fontFailures: string[] = [];
        const families = ["Inter Variable", "Fraunces Variable", "JetBrains Mono Variable"];
        for (const family of families) {
          const loaded = await document.fonts.load(`12px "${family}"`);
          if (loaded.length === 0 || loaded.some((face) => face.status !== "loaded")) {
            fontFailures.push(`${family} did not load`);
          }
        }
        await document.fonts.ready;
        if (document.fonts.status !== "loaded") {
          fontFailures.push(`FontFaceSet status is ${document.fonts.status}`);
        }

        const images = Array.from(document.images);
        await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
        const brokenImages = images
          .filter(
            (image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0,
          )
          .map((image) => image.currentSrc || image.src || "(missing src)");
        const tinyImages = images
          .filter(
            (image) =>
              image.naturalWidth > 0 &&
              image.naturalHeight > 0 &&
              (image.naturalWidth <= 1 || image.naturalHeight <= 1),
          )
          .map((image) => image.currentSrc || image.src || "(missing src)");

        const svgs = Array.from(document.querySelectorAll("svg"));
        const malformedSvgs = svgs.flatMap((svg, index) => {
          const viewBox = svg.getAttribute("viewBox")?.trim();
          const graphicalNodes = Array.from(
            svg.querySelectorAll("path, use, circle, rect, line, polyline, polygon, ellipse"),
          );
          const hasEmptyGeometry = graphicalNodes.some((node) => {
            if (node.tagName.toLowerCase() === "path") {
              return !(node.getAttribute("d") ?? "").trim();
            }
            if (node.tagName.toLowerCase() === "use") {
              return !(node.getAttribute("href") ?? node.getAttribute("xlink:href") ?? "").trim();
            }
            return false;
          });
          if (!viewBox || graphicalNodes.length === 0 || hasEmptyGeometry) {
            return [
              `svg[${index}] viewBox=${viewBox || "(missing)"} graphicalNodes=${graphicalNodes.length}`,
            ];
          }
          return [];
        });

        return {
          imageCount: images.length,
          svgCount: svgs.length,
          brokenImages,
          tinyImages,
          malformedSvgs,
          fontFailures,
        };
      });
      Object.assign(result, dom);
    } catch (error) {
      result.navigationErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const currentFile = fileURLToPath(import.meta.url);
  const reportPath = path.resolve(path.dirname(currentFile), "../../../../docs/UI-ASSET-REPORT.md");
  await writeFile(reportPath, reportMarkdown(results), "utf8");

  const issues = results.flatMap((result) =>
    rowIssues(result).map((detail) => `${result.route}: ${detail}`),
  );
  expect(issues, issues.join("\n")).toEqual([]);
});

const VIEWPORTS = [
  { name: "small-android", width: 320, height: 568 },
  { name: "iphone", width: 390, height: 844 },
  { name: "iphone-pro-max", width: 430, height: 932 },
  { name: "extension-popup", width: 400, height: 560 },
  { name: "tablet", width: 1024, height: 900 },
] as const;

const VISUAL_VIEWPORTS = [
  { name: "iphone-390", width: 390, height: 844 },
  { name: "popup-400", width: 400, height: 560 },
] as const;

type LayoutResult = {
  route: string;
  viewport: (typeof VIEWPORTS)[number]["name"];
  issues: string[];
};

function layoutReportMarkdown(results: LayoutResult[]): string {
  const failures = results.filter((result) => result.issues.length > 0);
  const byViewport = VIEWPORTS.map((viewport) => {
    const rows = results.filter((result) => result.viewport === viewport.name);
    return `| ${viewport.name} (${viewport.width}×${viewport.height}) | ${rows.length} | ${rows.filter((row) => row.issues.length === 0).length} | ${rows.filter((row) => row.issues.length > 0).length} |`;
  }).join("\n");
  const details =
    failures.length === 0
      ? "Không còn ca lỗi."
      : failures
          .map(
            (failure) =>
              `| \`${failure.route}\` | ${failure.viewport} | ${failure.issues.join("<br>")} |`,
          )
          .join("\n");

  return `# UI Layout Matrix Report — VíGiaĐình

Ngày chạy: 2026-07-25

Lệnh chuẩn: \`corepack pnpm test:layout\`

Phạm vi: 41 route × 5 viewport = ${results.length} ca trên Chromium production build, locale VI.

## Tổng hợp

- PASS: ${results.length - failures.length}/${results.length}
- FAIL: ${failures.length}/${results.length}
- Mỗi ca kiểm: scroll ngang, container cắt dọc, text bị clip, tap target dưới 48 px,
  ảnh có nguy cơ méo tỉ lệ và khả năng đưa nút submit vào vùng thấy được khi viewport bàn phím co.

| Viewport | Ca | PASS | FAIL |
|---|---:|---:|---:|
${byViewport}

## Chi tiết lỗi

| Route | Viewport | Lỗi |
|---|---|---|
${details}
`;
}

test("41 routes fit all five target viewports", async ({ page }) => {
  test.setTimeout(300_000);
  expect(ROUTES).toHaveLength(41);
  expect(VIEWPORTS).toHaveLength(5);
  await mockBackend(page);

  const results: LayoutResult[] = [];

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of ROUTES) {
      const issues: string[] = [];
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.locator(".product-screen").waitFor({ state: "visible", timeout: 8_000 });
      await page.waitForTimeout(50);

      const audit = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const shell = document.querySelector<HTMLElement>(".product-shell");
        const visible = (element: Element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const label = (element: Element) => {
          const text = element.textContent?.trim().replace(/\s+/g, " ");
          return `${element.tagName.toLowerCase()}${text ? ` "${text.slice(0, 48)}"` : ""}`;
        };

        const clippedText = Array.from(document.querySelectorAll<HTMLElement>("main *"))
          .filter(visible)
          .filter((element) =>
            Array.from(element.childNodes).some(
              (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
            ),
          )
          .filter((element) => {
            const style = getComputedStyle(element);
            const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
            const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
            return (
              (clipsX && element.scrollWidth > element.clientWidth + 1) ||
              (clipsY && element.scrollHeight > element.clientHeight + 1)
            );
          })
          .map(label);

        const smallTargets = Array.from(
          document.querySelectorAll<HTMLElement>(
            "main button, main a[href], main input, .product-shell__language",
          ),
        )
          .filter(visible)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width < 48 || rect.height < 48;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return `${label(element)} ${Math.round(rect.width)}×${Math.round(rect.height)}`;
          });

        const distortedImages = Array.from(document.images)
          .filter(visible)
          .filter((image) => image.naturalWidth > 0 && image.naturalHeight > 0)
          .filter((image) => {
            const rect = image.getBoundingClientRect();
            const naturalRatio = image.naturalWidth / image.naturalHeight;
            const renderedRatio = rect.width / rect.height;
            const fit = getComputedStyle(image).objectFit;
            return fit === "fill" && Math.abs(naturalRatio - renderedRatio) / naturalRatio > 0.02;
          })
          .map((image) => image.currentSrc || image.src);

        const shellStyle = shell ? getComputedStyle(shell) : null;
        const shellClipsVertical =
          shell !== null &&
          shell.scrollHeight > shell.clientHeight + 1 &&
          (shellStyle?.overflowY === "hidden" || shellStyle?.overflowY === "clip");

        return {
          clippedText,
          distortedImages,
          hasInput: Boolean(document.querySelector("main input, main textarea")),
          horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1,
          shellClipsVertical,
          smallTargets,
        };
      });

      if (audit.horizontalOverflow) issues.push("scroll ngang");
      if (audit.shellClipsVertical) issues.push("product shell cắt nội dung dọc");
      if (audit.clippedText.length > 0) {
        issues.push(`text bị clip: ${audit.clippedText.join(", ")}`);
      }
      if (audit.smallTargets.length > 0) {
        issues.push(`tap target <48px: ${audit.smallTargets.join(", ")}`);
      }
      if (audit.distortedImages.length > 0) {
        issues.push(`ảnh có nguy cơ méo: ${audit.distortedImages.join(", ")}`);
      }

      if (viewport.name === "extension-popup" && audit.hasInput) {
        const input = page.locator("main input, main textarea").last();
        await input.focus();
        await page.setViewportSize({ width: viewport.width, height: 320 });
        const submit = page
          .locator('main button[type="submit"], main [data-slot="family-button"]')
          .last();
        if ((await submit.count()) > 0) {
          await submit.scrollIntoViewIfNeeded();
          const box = await submit.boundingBox();
          if (!box || box.y < -1 || box.y + box.height > 321) {
            issues.push("nút submit không đưa được vào viewport bàn phím");
          }
        }
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      }

      results.push({ route, viewport: viewport.name, issues });
    }
  }

  const currentFile = fileURLToPath(import.meta.url);
  const reportPath = path.resolve(
    path.dirname(currentFile),
    "../../../../docs/UI-LAYOUT-REPORT.md",
  );
  await writeFile(reportPath, layoutReportMarkdown(results), "utf8");

  const failures = results
    .filter((result) => result.issues.length > 0)
    .map((result) => `${result.viewport} ${result.route}: ${result.issues.join("; ")}`);
  expect(results).toHaveLength(205);
  expect(failures, failures.join("\n")).toEqual([]);
});

test("Android Back returns send review to the intact entry form", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/wallet/send");
  await page.locator("#send-amount").fill("1,00");
  const recipient = CONTRACT_ADDRESS;
  await page.locator("#send-recipient").fill(recipient);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  const prepareResponse = page.waitForResponse((response) =>
    response.url().includes("/api/intents/send/prepare"),
  );
  await page.locator('button[type="submit"]').click();
  expect((await prepareResponse).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Kiểm tra trước khi gửi" })).toBeVisible();

  await page.goBack();

  await expect(page.locator("#send-amount")).toHaveValue("1,00");
  await expect(page.locator("#send-recipient")).toHaveValue(recipient);
  await expect(page.getByRole("heading", { name: "Kiểm tra trước khi gửi" })).toHaveCount(0);
});

test("safe-area viewport shell honors simulated device insets", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: {
      top: 47,
      topMax: 47,
      right: 0,
      rightMax: 0,
      bottom: 34,
      bottomMax: 34,
      left: 0,
      leftMax: 0,
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.goto("/wallet/send");
  await page.locator(".product-screen").waitFor({ state: "visible" });

  const platform = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".product-shell");
    const chrome = document.querySelector<HTMLElement>(".product-shell__chrome");
    const screen = document.querySelector<HTMLElement>(".product-screen");
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    return {
      hasStandaloneRule: Array.from(document.styleSheets).some((sheet) =>
        Array.from(sheet.cssRules).some((rule) =>
          rule.cssText.includes("(display-mode: standalone)"),
        ),
      ),
      viewport: viewport?.content ?? "",
      shellMinHeight: shell ? Number.parseFloat(getComputedStyle(shell).minHeight) : 0,
      topPadding: chrome ? Number.parseFloat(getComputedStyle(chrome).paddingTop) : 0,
      bottomPadding: screen ? Number.parseFloat(getComputedStyle(screen).paddingBottom) : 0,
    };
  });

  expect(platform.hasStandaloneRule).toBe(true);
  expect(platform.viewport).toContain("viewport-fit=cover");
  expect(platform.viewport).toContain("interactive-widget=resizes-content");
  expect(platform.shellMinHeight).toBeGreaterThanOrEqual(843);
  expect(platform.topPadding).toBeGreaterThanOrEqual(47);
  expect(platform.bottomPadding).toBeGreaterThanOrEqual(34);
});

for (const viewport of VISUAL_VIEWPORTS) {
  for (const [index, route] of ROUTES.entries()) {
    const slug =
      route
        .replace(/[?#].*$/, "")
        .replace(/^\/|\/$/g, "")
        .replaceAll("/", "-")
        .replaceAll("$", "") || "home";

    test(`visual regression ${viewport.name} ${route}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockBackend(page);
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.locator(".product-screen").waitFor({ state: "visible", timeout: 8_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
        );
      });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-delay: 0s !important;
            animation-duration: 0s !important;
            caret-color: transparent !important;
            transition: none !important;
          }
          html { scroll-behavior: auto !important; }
          ::-webkit-scrollbar { display: none !important; }
        `,
      });

      await expect(page).toHaveScreenshot(
        `${String(index + 1).padStart(2, "0")}-${slug}-${viewport.name}.png`,
        {
          animations: "disabled",
          caret: "hide",
          fullPage: true,
          mask: [
            page.locator(
              '[data-testid*="countdown"], [data-testid*="identity-address"], .money-amount, code, time',
            ),
          ],
          maxDiffPixelRatio: 0.01,
        },
      );
    });
  }
}
