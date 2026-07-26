// WHY: rpId là quyết định KHÔNG ĐẢO LẠI ĐƯỢC. Authenticator băm SHA-256 rpId và
// nhúng vào credential ngay lúc tạo — không API nào sửa, không đường migrate.
// Rơi về "localhost" trong bản production nghĩa là mọi passkey người dùng tạo ra
// đều chết vĩnh viễn trên domain thật, và chỉ phát hiện được khi đã có người dùng.
//
// Vite nướng env lúc BUILD → không có gác này thì bản prod vẫn build xanh, deploy
// xanh, hỏng im lặng. Test khoá đúng hai điều: file production mẫu phải chốt đúng
// domain, và nó KHÔNG được là apex.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const PROD_ENV = join(import.meta.dirname, "../../env.production.example");
const RP_ID = "familyhaven.mscilabs.com";

function activeVars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m?.[1]) out[m[1]] = (m[2] ?? "").trim();
  }
  return out;
}

describe("rpId production — quyết định không đảo lại được", () => {
  const vars = activeVars(readFileSync(PROD_ENV, "utf8"));

  test("chốt đúng familyhaven.mscilabs.com", () => {
    expect(vars.VITE_PASSKEY_RP_ID).toBe(RP_ID);
  });

  test("KHÔNG phải apex — apex cho mọi subdomain gọi được passkey ví", () => {
    // rpId là scope. `mscilabs.com` nghĩa là bất kỳ *.mscilabs.com nào cũng gọi
    // được passkey điều khiển tiền → một subdomain dính XSS là đủ.
    expect(vars.VITE_PASSKEY_RP_ID).not.toBe("mscilabs.com");
    expect(vars.VITE_PASSKEY_RP_ID).not.toBe("localhost");
  });

  test("rpId phải là hậu tố đăng ký được của origin FE (luật WebAuthn)", () => {
    // Trình duyệt từ chối credential nếu rpId không phải suffix của origin.
    const origin = new URL(`https://${RP_ID}`);
    expect(origin.hostname.endsWith(vars.VITE_PASSKEY_RP_ID ?? "")).toBe(true);
  });

  test("API trỏ domain thật, không còn localhost", () => {
    expect(vars.VITE_API_URL).toBe("https://api.familyhaven.mscilabs.com");
  });
});
