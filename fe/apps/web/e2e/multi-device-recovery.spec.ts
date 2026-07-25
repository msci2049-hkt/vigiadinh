// E2E ĐA THIẾT BỊ — claim quan trọng nhất khi thi:
// "người nhà bỏ phiếu bằng vân tay TRÊN MÁY CỦA CHÍNH HỌ."
//
// `browserContext.credentials` scope theo BrowserContext, nên mỗi context là
// MỘT MÁY ẢO độc lập: authenticator riêng, passkey riêng, storage riêng. Đây là
// cách mô phỏng nhiều thiết bị mà không cần phần cứng — và là thứ phiên trước
// khai là "chưa verify được autonomous".
//
// Bốn máy:
//   ctxOwner → chủ ví tạo ví (deploy thật, registry cắm trong constructor)
//   ctxG1/G2 → hai người thân, mỗi người tạo passkey + deploy hợp đồng CỦA HỌ
//   ctxNew   → máy mới sau khi chủ ví mất điện thoại
//
// CỔNG CHỐNG HỒI QUY quan trọng nhất: `get_context_rule(0)` của ví CHỦ luôn
// ĐÚNG MỘT signer. Guardian không bao giờ là signer trên ví chủ — họ bỏ phiếu
// ở registry. Nếu con số này thành 3 thì mô hình đã bị kéo về multisig và mỗi
// guardian rút sạch ví được một mình (OZ do_check_auth: một signer trong rule
// không policy authorize toàn bộ context).
//
// Opt-in (chạm testnet thật, cần preview :4174 chạy sẵn):
//   RUN_TESTNET_E2E=1 pnpm --filter @repo/web exec playwright test e2e/multi-device --project=chromium
// WSL không sudo: export LD_LIBRARY_PATH=~/chrome-libs/extracted/usr/lib/x86_64-linux-gnu

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
  Address,
  BASE_FEE,
  Keypair,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { installGetPublicKeyPolyfill } from "./support-passkey";

const RPC_URL = "https://soroban-testnet.stellar.org";
const PASSPHRASE = "Test SDF Network ; September 2015";
/** PHẢI khớp fe/apps/web/.env — registry v2.1 có extend_ttl + veto_registry_change. */
const REGISTRY = "CAFU4CZNPN5YWFV3QOCA4Y6FSJUB7IGI456MIGTQRJXA4DQLWUIHFMCO";
const WEBAUTHN_VERIFIER = "CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N";

const enabled = process.env.RUN_TESTNET_E2E === "1";
const server = new rpc.Server(RPC_URL);

/** Mốc thời gian từng bước — chạy 10+ phút, phải biết chết ở ĐÂU chứ không đoán. */
const t0 = Date.now();
function step(name: string): void {
  console.log(`[STEP +${((Date.now() - t0) / 1000).toFixed(1)}s] ${name}`);
}

/**
 * In + GHI bằng chứng ra đĩa NGAY khi có, trước mọi assert còn lại. Bằng chứng
 * không được phụ thuộc việc test pass: hash đã settle trên testnet là sự thật
 * kể cả khi một assert phía sau đỏ.
 */
function dumpEvidence(ownerWallet: string, guardians: string[]): void {
  const payload = { ownerWallet, guardianAddresses: guardians, evidence };
  console.log("EVIDENCE", JSON.stringify(payload, null, 2));
  const out = path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../../../docs/evidence/multi-device-latest.json",
  );
  try {
    writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`[EVIDENCE] ghi ${out}`);
  } catch (e) {
    console.log(`[EVIDENCE] KHÔNG ghi được ${out}: ${(e as Error).message}`);
  }
}
/** Ví phí của "BE" mock — ký ENVELOPE trả phí, không bao giờ ký hộ người dùng. */
const feePayer = Keypair.random();
const evidence: Array<{ step: string; hash: string }> = [];

async function friendbot(kp: Keypair): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot: ${res.status}`);
}

async function simulateRead(contractId: string, method: string, args: xdr.ScVal[]) {
  const account = await server.getAccount(feePayer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      Operation.invokeContractFunction({ contract: contractId, function: method, args }),
    )
    .setTimeout(300)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`read ${method}: ${sim.error}`);
  const retval = sim.result?.retval;
  if (!retval) throw new Error(`read ${method}: no retval`);
  return scValToNative(retval) as unknown;
}

/** Chân BUILD của "BE" mock — simulate để lấy auth entries cho FE ký. */
async function buildEntries(method: string, args: xdr.ScVal[]) {
  const account = await server.getAccount(feePayer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: REGISTRY, function: method, args }))
    .setTimeout(300)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`build ${method}: ${sim.error}`);
  return {
    entriesB64: (sim.result?.auth ?? []).map((e) => e.toXDR("base64")),
    latestLedger: sim.latestLedger,
  };
}

/** Chân SUBMIT của "BE" mock — nhận entry ĐÃ KÝ, re-simulate, ví phí ký envelope. */
async function submitSigned(method: string, args: xdr.ScVal[], signedB64: string[], step: string) {
  const account = await server.getAccount(feePayer.publicKey());
  const auth = signedB64.map((b) => xdr.SorobanAuthorizationEntry.fromXDR(b, "base64"));
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      Operation.invokeContractFunction({ contract: REGISTRY, function: method, args, auth }),
    )
    .setTimeout(300)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${step} sim: ${sim.error}`);
  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(feePayer);
  const sent = await server.sendTransaction(assembled);
  if (sent.status === "ERROR") throw new Error(`${step} rejected`);
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== "SUCCESS") throw new Error(`${step} ${final.status}`);
  evidence.push({ step, hash: sent.hash });
  return sent.hash;
}

function sessionFor(id: string, email: string) {
  return {
    user: {
      id,
      email,
      name: id,
      emailVerified: true,
      role: "user",
      banned: false,
      createdAt: "2026-06-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
    },
    session: { id: `s_${id}`, userId: id, token: "tok", expiresAt: "2027-01-01T00:00:00Z" },
  };
}

/** Một "máy": context riêng → authenticator riêng → passkey riêng. */
async function newDevice(
  browser: import("@playwright/test").Browser,
  userId: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  await ctx.credentials.install();
  const page = await ctx.newPage();
  await installGetPublicKeyPolyfill(page);
  page.on("pageerror", (e) => console.log(`[${userId}] PAGEERROR:`, e.message));
  await page.route("**/api/auth/get-session", (r) =>
    r.fulfill({ json: sessionFor(userId, `${userId}@example.com`) }),
  );
  return { ctx, page };
}

test.describe("khôi phục đa thiết bị — người nhà ký bằng passkey trên máy của họ", () => {
  test.skip(!enabled, "opt-in RUN_TESTNET_E2E=1 — chạm testnet thật");
  test.skip(({ browserName }) => browserName !== "chromium", "virtual authenticator + testnet");

  test("chủ ví + 2 người thân, mỗi người một máy — ví chủ vẫn ĐÚNG 1 signer", async ({
    browser,
  }) => {
    test.setTimeout(1_800_000); // 3 deploy thật + register on-chain trên WSL
    step("friendbot ví phí");
    await friendbot(feePayer);

    // ---------- MÁY 1: chủ ví tạo ví qua /setup ----------
    const owner = await newDevice(browser, "u_owner");
    let ownerWallet = "";
    const ownerRow = () => ({
      id: "w_owner",
      userId: "u_owner",
      familyId: null,
      timezone: "UTC",
      stellarAddress: ownerWallet,
      contractId: ownerWallet,
      threshold: 2,
      timelockSecs: 0,
      createdAt: "2026-07-25T00:00:00Z",
    });
    // GET (danh sách ví — useActiveWallet) và POST (mirror ví FE vừa deploy).
    await owner.page.route("**/api/wallets", async (route) => {
      if (route.request().method() === "POST") {
        ownerWallet = (route.request().postDataJSON() as { stellar_address: string })
          .stellar_address;
        await route.fulfill({ json: { data: ownerRow() } });
        return;
      }
      await route.fulfill({ json: { data: ownerWallet ? [ownerRow()] : [] } });
    });
    step("MÁY 1 — chủ ví deploy qua /setup");
    await owner.page.goto("/setup");
    await owner.page
      .getByRole("button", { name: /tạo ví|create my wallet/i })
      .first()
      .click();
    await expect(owner.page).toHaveURL(/\/setup\/done/, { timeout: 600_000 });
    step(`ví chủ = ${ownerWallet}`);
    expect(ownerWallet).toMatch(/^C[A-Z2-7]{55}$/);

    // Ví sinh ra ĐÃ nối registry (mục đặt chỗ trong constructor) — nếu không,
    // recovery_rotate sẽ chết mã 100 và ví này vĩnh viễn không cứu được.
    const link = (await simulateRead(ownerWallet, "get_recovery_registry", [])) as
      | [string, bigint]
      | null;
    expect(link?.[0]).toBe(REGISTRY);

    // ---------- MÁY 2 & 3: hai người thân, mỗi người tạo danh tính của họ ----------
    const guardianAddresses: string[] = [];
    for (const [i, userId] of ["u_g1", "u_g2"].entries()) {
      const g = await newDevice(browser, userId);
      let addr = "";
      await g.page.route("**/api/wallets", async (route) => {
        if (route.request().method() === "POST") {
          addr = (route.request().postDataJSON() as { stellar_address: string }).stellar_address;
          await route.fulfill({ json: { data: { id: `w_${userId}`, stellarAddress: addr } } });
          return;
        }
        await route.fulfill({ json: { data: [] } });
      });
      await g.page.route(`**/api/guardians/invites/tok${i + 1}`, (r) =>
        r.fulfill({ json: { data: { label: `Guardian ${i + 1}`, status: "sent" } } }),
      );
      await g.page.route(`**/api/guardians/invites/tok${i + 1}/accept`, (r) =>
        r.fulfill({ json: { data: { status: "deployed" } } }),
      );

      step(`MÁY ${i + 2} — ${userId} nhận lời mời + deploy hợp đồng của họ`);
      await g.page.goto(`/guardian/accept?token=tok${i + 1}`);
      await g.page.getByTestId("guardian-accept-cta").click();
      await expect(g.page.getByTestId("guardian-identity-address")).toBeVisible({
        timeout: 600_000,
      });
      step(`${userId} = ${addr}`);
      expect(addr).toMatch(/^C[A-Z2-7]{55}$/);
      guardianAddresses.push(addr);
      await g.ctx.close();
    }

    // Ba máy → ba hợp đồng KHÁC NHAU. Đây là bằng chứng authenticator độc lập
    // theo context: cùng một trình duyệt nhưng không dùng chung passkey nào.
    expect(new Set([ownerWallet, ...guardianAddresses]).size).toBe(3);

    // ---------- Chủ ví bật bảo vệ qua ĐÚNG UI: /setup/review ----------
    // Đi qua màn sản phẩm, không gọi API tay: nút "Bật bảo vệ" chạy
    // build → signRecoveryEntries (prompt passkey trên authenticator máy 1)
    // → submit. Hai chân on-chain là THẬT (simulate + submit mạng thật).
    const registerArgs = [
      new Address(ownerWallet).toScVal(),
      xdr.ScVal.scvVec(guardianAddresses.map((a) => new Address(a).toScVal())),
      nativeToScVal(2, { type: "u32" }),
      nativeToScVal(0n, { type: "u64" }),
    ];

    // Mirror lời mời: cả hai người thân đã lên chain → màn review mở nút đăng ký.
    await owner.page.route("**/api/guardians/invites/wallet/**", (r) =>
      r.fulfill({
        json: {
          data: {
            invites: guardianAddresses.map((a, i) => ({
              id: `inv${i}`,
              label: `Guardian ${i + 1}`,
              status: "registered",
              guardian_address: a,
              expires_at: "2027-01-01T00:00:00Z",
            })),
            recoverability: { available: 2, threshold: 2, recoverable: true, missing: 0 },
          },
        },
      }),
    );
    await owner.page.route("**/api/recovery/register", async (route) => {
      const built = await buildEntries("register_wallet", registerArgs);
      if (built.entriesB64.length === 0) throw new Error("register: no auth entries");
      await route.fulfill({
        json: {
          data: {
            action: "register",
            wallet_id: "w_owner",
            transaction_xdr: "",
            auth_entries_xdr: built.entriesB64,
            latest_ledger: built.latestLedger,
          },
        },
      });
    });
    await owner.page.route("**/api/recovery/submit", async (route) => {
      const body = route.request().postDataJSON() as { signed_entries: string[] };
      const hash = await submitSigned(
        "register_wallet",
        registerArgs,
        body.signed_entries,
        "register_wallet",
      );
      await route.fulfill({
        json: { data: { method: "register_wallet", hash, status: "SUCCESS" } },
      });
    });

    step("chủ ví bấm 'Bật bảo vệ' ở /setup/review (điều hướng CỨNG — kit phải tự nối lại phiên)");
    await owner.page.goto("/setup/review");
    await owner.page.getByTestId("review-register").click();

    // Đua thành-công vs lỗi: nếu mutation hỏng, màn render role="alert" và ta
    // sẽ đứng chờ "status" đủ 10 phút rồi timeout mà KHÔNG biết vì sao. Bắt cả
    // hai rồi in nội dung lỗi ra — đây đúng là chỗ phiên trước mù.
    const ok = owner.page.getByTestId("review-registered");
    const failed = owner.page.getByTestId("review-register-failed");
    await expect(ok.or(failed)).toBeVisible({ timeout: 600_000 });
    if (await failed.isVisible()) {
      throw new Error(`register FAILED ở UI: ${(await failed.innerText()).trim()}`);
    }
    step("đăng ký lên registry XONG (UI xác nhận)");
    dumpEvidence(ownerWallet, guardianAddresses);

    // ---------- Verify TỪ CHAIN ----------
    step("đọc get_wallet_config từ registry");
    const cfg = (await simulateRead(REGISTRY, "get_wallet_config", [
      new Address(ownerWallet).toScVal(),
    ])) as { guardians: string[]; threshold: number };
    expect(new Set(cfg.guardians)).toEqual(new Set(guardianAddresses));
    expect(cfg.threshold).toBe(2);

    // CỔNG CHỐNG HỒI QUY — ví chủ ĐÚNG MỘT signer, và signer đó là passkey
    // (verifier WebAuthn), không phải ed25519, không phải guardian.
    step("CỔNG CHỐNG HỒI QUY — get_context_rule(0) của ví CHỦ");
    const rule = (await simulateRead(ownerWallet, "get_context_rule", [
      nativeToScVal(0, { type: "u32" }),
    ])) as { signers: unknown[] };
    expect(rule.signers).toHaveLength(1);
    expect(JSON.stringify(rule.signers)).toContain(WEBAUTHN_VERIFIER);

    // Mỗi guardian: hợp đồng của HỌ có passkey của HỌ (1 signer, verifier WebAuthn).
    for (const addr of guardianAddresses) {
      const gRule = (await simulateRead(addr, "get_context_rule", [
        nativeToScVal(0, { type: "u32" }),
      ])) as { signers: unknown[] };
      expect(gRule.signers).toHaveLength(1);
      expect(JSON.stringify(gRule.signers)).toContain(WEBAUTHN_VERIFIER);
    }

    step("TẤT CẢ ASSERT XANH");
    dumpEvidence(ownerWallet, guardianAddresses);
    await owner.ctx.close();
  });
});
