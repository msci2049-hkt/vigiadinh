// E2e passkey login (PHA 2.3) — virtual authenticator của Playwright 1.61
// (context.credentials, xem RESEARCH-LOG root):
//   1. Cài virtual authenticator → nút "tạo ví" chạy WebAuthn ceremony THẬT headless.
//   2. kit.createWallet dựng smart account từ WASM hash thật (simulate deploy qua
//      RPC TESTNET THẬT — mạng cần sống; đây cũng là integration check bindings
//      kit ↔ contract OZ 0.7.2 của ta).
//   3. BE sep45 MOCK qua page.route (triết lý e2e repo: không cần backend) —
//      challenge dựng XDR thật trong test, /token GIẢI MÃ và ASSERT entry của ví
//      ĐÃ ĐƯỢC KÝ (AuthPayload không rỗng) rồi mới trả JWT.
//   4. UI báo "ví đã mở" + JWT nằm trong localStorage → Bearer sẵn sàng.
// Chỉ chạy chromium: giảm bề mặt flake mạng (3 browser × testnet). Firefox/webkit
// phủ ở test khác không chạm mạng.
import { expect, test } from "@playwright/test";
import { Address, StrKey, xdr } from "@stellar/stellar-sdk";

const SERVER_G = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
const WEB_AUTH_C = StrKey.encodeContract(Buffer.alloc(32, 7));
const NONCE = "e2e-nonce-0123456789abcdef";

function argsMap(account: string): xdr.ScVal {
  const pairs: [string, string][] = [
    ["account", account],
    ["home_domain", "localhost:5173"],
    ["nonce", NONCE],
    ["web_auth_domain", "localhost:3000"],
    ["web_auth_domain_account", SERVER_G],
  ];
  return xdr.ScVal.scvMap(
    pairs.map(
      ([k, v]) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: xdr.ScVal.scvString(v) }),
    ),
  );
}

function makeEntry(address: string, account: string): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(address).toScAddress(),
        nonce: new xdr.Int64(7n),
        signatureExpirationLedger: 999_999_999,
        signature: xdr.ScVal.scvVec([]),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(WEB_AUTH_C).toScAddress(),
          functionName: "web_auth_verify",
          args: [argsMap(account)],
        }),
      ),
      subInvocations: [],
    }),
  });
}

function encodeEntries(entries: xdr.SorobanAuthorizationEntry[]): string {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(entries.length, 0);
  return Buffer.concat([count, ...entries.map((e) => e.toXDR())]).toString("base64");
}

function fakeJwt(sub: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, exp, device: "e2e" })}.${"x".repeat(43)}`;
}

test.describe("passkey → smart account → SEP-45 login", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "mạng testnet — chỉ chromium");

  test("tạo ví bằng passkey ảo rồi đăng nhập, entry ví PHẢI được ký thật", async ({
    context,
    page,
  }) => {
    test.setTimeout(180_000); // simulate deploy chạy qua testnet thật — cho dư thời gian.
    await context.credentials.install();

    let signedByWallet = false;

    await page.route("**/api/sep45/challenge*", async (route) => {
      const url = new URL(route.request().url());
      const account = url.searchParams.get("account") ?? "";
      expect(account).toMatch(/^C[A-Z2-7]{55}$/); // FE phải gửi đúng contract id của ví mới
      expect(url.searchParams.get("device_id")).toBeTruthy(); // bind thiết bị (checklist 2.3)
      await route.fulfill({
        json: {
          authorization_entries: encodeEntries([
            makeEntry(SERVER_G, account),
            makeEntry(account, account),
          ]),
          network_passphrase: "Test SDF Network ; September 2015",
        },
      });
    });

    await page.route("**/api/sep45/token", async (route) => {
      const body = route.request().postDataJSON() as { authorization_entries: string };
      const raw = Buffer.from(body.authorization_entries, "base64");
      const entries = xdr.SorobanAuthorizationEntries.fromXDR(raw, "raw");
      expect(entries).toHaveLength(2);
      // Entry server giữ nguyên (vec rỗng); entry ví PHẢI có AuthPayload thật.
      let walletAccount = "";
      const signatures: string[] = [];
      for (const entry of entries) {
        const creds = entry.credentials().address();
        const addr = Address.fromScAddress(creds.address()).toString();
        const sig = creds.signature();
        signatures.push(`${addr}:${sig.switch().name}`);
        if (addr.startsWith("C")) {
          walletAccount = addr;
          const stillEmpty =
            sig.switch() === xdr.ScValType.scvVec() && (sig.vec()?.length ?? 0) === 0;
          expect(stillEmpty, `entry ví chưa được ký: ${signatures.join(", ")}`).toBe(false);
          signedByWallet = true;
        }
      }
      expect(walletAccount).toMatch(/^C/);
      await route.fulfill({ json: { token: fakeJwt(walletAccount) } });
    });

    await page.goto("/passkey");
    await page.getByTestId("passkey-create").click();

    await expect(page.getByTestId("passkey-status")).toContainText("Ví của bạn đã mở", {
      timeout: 150_000,
    });
    expect(signedByWallet).toBe(true);

    const jwt = await page.evaluate(() => localStorage.getItem("fw.wallet-jwt"));
    expect(jwt).toBeTruthy();
  });
});
