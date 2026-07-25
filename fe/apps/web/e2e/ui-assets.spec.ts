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
