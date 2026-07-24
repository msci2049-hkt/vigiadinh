// E2E TESTNET THẬT — ĐÓNG MẮT XÍCH PASSKEY (checklist §1): chứng minh WebAuthn
// secp256r1 (virtual authenticator) ký được TX THẬT qua ĐÚNG luồng sản phẩm:
//   /setup (kit.createWallet autoSubmit → DEPLOY THẬT, signer = passkey secp256r1)
//   → /wallet/send (signWalletEntries → kit.signAuthEntry → __check_auth
//   → origin-verifier → SAC transfer 1 XLM, MỘT tx, settled).
// BE mock qua page.route (triết lý e2e repo) nhưng HAI CHÂN ON-CHAIN THẬT:
// handler confirm BUILD tx thật (simulate qua RPC), handler sign SUBMIT thật
// (mirror be/services/stellar invokeWithSignedEntries). Verify độc lập:
//   - get_context_rule(0) đọc TỪ SMART ACCOUNT: signer External(webauthn-verifier,
//     key secp256r1 65 byte 0x04…) — KHÔNG phải ed25519.
//   - người nhận NHẬN ĐỦ 1 XLM (đọc SAC.balance trước/sau).
// Opt-in (chạm testnet thật + cần preview đang chạy sẵn ở :4174):
//   RUN_TESTNET_E2E=1 pnpm --filter @repo/web exec playwright test e2e/passkey-onchain --project=chromium
// WSL không sudo: export LD_LIBRARY_PATH=~/chrome-libs/extracted/usr/lib/x86_64-linux-gnu
// (xem BLOCKERS B-CI-2 — cách dựng ~/chrome-libs bằng apt-get download + dpkg -x).
import { expect, test } from "@playwright/test";
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
/** SAC native XLM testnet (deterministic theo network). */
const SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
/** origin-verifier DEV (rpId=localhost, origins :5173+:4174) — PHẢI khớp fe/.env. */
const WEBAUTHN_VERIFIER = "CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N";
/** verifier-ed25519 (audit P0) — signer của ví KHÔNG được là cái này. */
const VERIFIER_ED25519 = "CAIPS7XW727UO75DFOWOG6PALED53KPYXYUELZZ7MLG7ZLS6OX72LLBT";
const AMOUNT = 10_000_000n; // 1 XLM

const enabled = process.env.RUN_TESTNET_E2E === "1";
const server = new rpc.Server(RPC_URL);
const feePayer = Keypair.random(); // ví phí của "BE" mock — ký envelope, không ký hộ user
const funder = Keypair.random(); // G nạp XLM vào ví C…
const recipient = Keypair.random(); // người nhận
const evidence: Array<{ step: string; hash: string }> = [];

async function friendbot(kp: Keypair): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot ${kp.publicKey()}: ${res.status}`);
}

function transferArgs(from: string, to: string, amount: bigint): xdr.ScVal[] {
  return [
    new Address(from).toScVal(),
    new Address(to).toScVal(),
    nativeToScVal(amount, { type: "i128" }),
  ];
}

/** Build + simulate + (ký envelope) + submit + poll — dùng chung nạp tiền & gửi. */
async function submitInvoke(input: {
  source: Keypair;
  contract: string;
  method: string;
  args: xdr.ScVal[];
  auth?: xdr.SorobanAuthorizationEntry[];
  step: string;
}): Promise<string> {
  const account = await server.getAccount(input.source.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      Operation.invokeContractFunction({
        contract: input.contract,
        function: input.method,
        args: input.args,
        ...(input.auth ? { auth: input.auth } : {}),
      }),
    )
    .setTimeout(300)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${input.step} sim: ${sim.error}`);
  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(input.source);
  const sent = await server.sendTransaction(assembled);
  if (sent.status === "ERROR") throw new Error(`${input.step} rejected`);
  const final = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== "SUCCESS") throw new Error(`${input.step} ${final.status}`);
  evidence.push({ step: input.step, hash: sent.hash });
  return sent.hash;
}

/** Chân BUILD của "BE" mock: simulate transfer từ ví C… → entries + latestLedger. */
async function buildTransferEntries(
  walletC: string,
): Promise<{ txXdr: string; entriesB64: string[]; latestLedger: number }> {
  const account = await server.getAccount(feePayer.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      Operation.invokeContractFunction({
        contract: SAC,
        function: "transfer",
        args: transferArgs(walletC, recipient.publicKey(), AMOUNT),
      }),
    )
    .setTimeout(300)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`build sim: ${sim.error}`);
  const entries = sim.result?.auth ?? [];
  if (entries.length === 0) throw new Error("build: no auth entries");
  return {
    txXdr: tx.toXDR(),
    entriesB64: entries.map((e) => e.toXDR("base64")),
    latestLedger: sim.latestLedger,
  };
}

/** View qua simulation (mirror BE simulateRead). */
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

async function balanceOf(address: string): Promise<bigint> {
  const raw = await simulateRead(SAC, "balance", [new Address(address).toScVal()]);
  return BigInt(raw as string | number | bigint);
}

const SESSION = {
  user: {
    id: "u_owner",
    email: "owner@example.com",
    name: "Owner",
    emailVerified: true,
    role: "user",
    banned: false,
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  session: { id: "s1", userId: "u_owner", token: "tok", expiresAt: "2027-01-01T00:00:00Z" },
};

test.describe("passkey secp256r1 → __check_auth → verifier → SAC transfer (testnet THẬT)", () => {
  test.skip(!enabled, "opt-in RUN_TESTNET_E2E=1 — chạm testnet thật");
  test.skip(({ browserName }) => browserName !== "chromium", "virtual authenticator + testnet");

  test("tạo ví bằng passkey (deploy thật) rồi GỬI 1 XLM ký bằng passkey — settled", async ({
    context,
    page,
  }) => {
    test.setTimeout(900_000); // WSL + testnet: deploy+poll đo được có thể >5'
    // Debug on-chain runs: lỗi trang/console là manh mối duy nhất khi headless.
    page.on("pageerror", (err) => console.log("PAGEERROR:", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`PAGE ${msg.type()}:`, msg.text().slice(0, 500));
      }
    });
    page.on("requestfailed", (r) => {
      console.log("REQFAIL:", r.url().slice(0, 120), r.failure()?.errorText);
    });
    await friendbot(feePayer);
    await friendbot(funder);
    await friendbot(recipient);
    await context.credentials.install();
    // Shim Playwright thiếu getPublicKey — polyfill CHỈ trong test (support-passkey.ts).
    await installGetPublicKeyPolyfill(page);

    // ---- BE mock: session + mirror ví (POST /api/wallets bắt địa chỉ C… thật FE deploy)
    let mirror: Record<string, unknown> | null = null;
    let walletC = "";
    await page.route("**/api/auth/get-session", (r) => r.fulfill({ json: SESSION }));
    await page.route("**/api/wallets", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { stellar_address: string };
        walletC = body.stellar_address;
        mirror = {
          id: "w_e2e",
          userId: "u_owner",
          familyId: null,
          timezone: "UTC",
          stellarAddress: walletC,
          contractId: walletC,
          threshold: 1,
          timelockSecs: 0,
          createdAt: "2026-07-24T00:00:00Z",
        };
        await route.fulfill({ json: { data: mirror } });
        return;
      }
      await route.fulfill({ json: { data: mirror ? [mirror] : [] } });
    });

    // ---- BE mock send-flow: confirm BUILD THẬT, sign SUBMIT THẬT
    let intentId = "";
    let sentHash = "";
    await page.route("**/api/intents/send/prepare", async (route) => {
      const body = route.request().postDataJSON() as { recipient: string; amount: string };
      intentId = `intent-${Date.now()}`;
      await route.fulfill({
        json: {
          data: {
            intentId,
            status: "review",
            from: walletC,
            recipient: body.recipient,
            amount: body.amount,
            balance: (await balanceOf(walletC)).toString(),
          },
        },
      });
    });
    await page.route("**/api/intents/send/confirm", async (route) => {
      try {
        const built = await buildTransferEntries(walletC);
        await route.fulfill({
          json: {
            data: {
              intentId,
              status: "awaiting_signature",
              transactionXdr: built.txXdr,
              authEntriesXdr: built.entriesB64,
              latestLedger: built.latestLedger,
            },
          },
        });
      } catch (err) {
        console.log("MOCK confirm ERROR:", String(err).slice(0, 400));
        await route.fulfill({ status: 500, json: { error: { message: String(err) } } });
      }
    });
    await page.route("**/api/intents/send/sign", async (route) => {
      try {
        const body = route.request().postDataJSON() as { signed_entries: string[] };
        const auth = body.signed_entries.map((b64) =>
          xdr.SorobanAuthorizationEntry.fromXDR(b64, "base64"),
        );
        sentHash = await submitInvoke({
          source: feePayer,
          contract: SAC,
          method: "transfer",
          args: transferArgs(walletC, recipient.publicKey(), AMOUNT),
          auth,
          step: "send-1xlm-passkey",
        });
        await route.fulfill({ json: { data: { intentId, status: "settled", hash: sentHash } } });
      } catch (err) {
        console.log("MOCK sign/submit ERROR:", String(err).slice(0, 600));
        await route.fulfill({ status: 500, json: { error: { message: String(err) } } });
      }
    });

    // ---- 1) /setup: passkey ảo + kit.createWallet(autoSubmit) = DEPLOY THẬT
    await page.goto("/setup");
    await page.getByRole("button", { name: "Tạo ví của tôi" }).click();
    await expect(page.getByText("Ví của bạn đã được bảo vệ")).toBeVisible({ timeout: 480_000 });
    expect(walletC).toMatch(/^C[A-Z2-7]{55}$/);

    // ---- 2) Nạp 3 XLM vào ví C… (G funder → SAC transfer, source-account auth)
    await submitInvoke({
      source: funder,
      contract: SAC,
      method: "transfer",
      args: transferArgs(funder.publicKey(), walletC, 30_000_000n),
      step: "fund-wallet-c",
    });
    const before = await balanceOf(recipient.publicKey());

    // ---- 3) SPA nav (giữ kit singleton đang connect) → màn gửi tiền
    await page.getByRole("link", { name: "Đến ví của tôi" }).click();
    await page.getByRole("link", { name: "Gửi", exact: true }).click();
    await page.locator("#send-amount").fill("1");
    await page.locator("#send-recipient").fill(recipient.publicKey());
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // ---- 4) Review → cổng sinh trắc học (passkey ảo ký entry) → settled
    await page.getByRole("button", { name: "Xác nhận và gửi" }).click();
    await expect(page.getByText("Đã gửi")).toBeVisible({ timeout: 180_000 });
    expect(sentHash).not.toBe("");
    await expect(page.getByText(sentHash.slice(0, 8))).toBeVisible();

    // ---- 5) Verify độc lập từ chain
    // Người nhận NHẬN ĐỦ đúng 1 XLM.
    expect((await balanceOf(recipient.publicKey())) - before).toBe(AMOUNT);
    // Signer của ví đọc TỪ SMART ACCOUNT: External(webauthn-verifier, secp256r1).
    const rule = (await simulateRead(walletC, "get_context_rule", [xdr.ScVal.scvU32(0)])) as {
      signers: Array<[string, string, Buffer]>;
    };
    expect(rule.signers).toHaveLength(1);
    const signer = rule.signers[0];
    if (!signer) throw new Error("no signer");
    const [kind, verifier, key] = signer;
    expect(kind).toBe("External");
    expect(verifier).toBe(WEBAUTHN_VERIFIER);
    expect(verifier).not.toBe(VERIFIER_ED25519);
    // keyData = pubkey secp256r1 65B (0x04‖x‖y) + credentialId suffix (kit nối
    // để reverse-lookup; verifier canonicalize lấy 65B đầu khi verify).
    const keyBuf = Buffer.from(key);
    expect(keyBuf.length).toBeGreaterThanOrEqual(65);
    expect(keyBuf[0]).toBe(0x04);

    console.log("=== TX EVIDENCE (chép vào docs/evidence/TESTNET.md §PASSKEY-ONCHAIN) ===");
    console.log(`wallet C…: https://stellar.expert/explorer/testnet/contract/${walletC}`);
    for (const t of evidence) {
      console.log(`${t.step}: https://stellar.expert/explorer/testnet/tx/${t.hash}`);
    }
  });
});
