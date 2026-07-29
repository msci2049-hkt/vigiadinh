// GHIM công thức DefaultInstallParams bằng vector XDR (khuôn recovery-link.test):
// FE (constructor lúc tạo ví) và BE (add_policy cho ví cũ — onchain-policy/domain)
// PHẢI dựng ra CÙNG một ScVal — lệch một byte là policy cài sai trần/kỳ đo/token.
// Vector sinh từ stellar-sdk với bộ giá trị production D2 (20.000 XLM / 17280
// ledger / SAC testnet) — BE có test đối xứng cùng literal.
import { describe, expect, it } from "vitest";
import {
  ONCHAIN_CAP_STROOPS,
  ONCHAIN_PERIOD_LEDGERS,
  spendingLimitInstallParamsScVal,
} from "./policy-link";

const SAC_TESTNET = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const VECTOR_B64 =
  "AAAAEQAAAAEAAAADAAAADwAAAA5wZXJpb2RfbGVkZ2VycwAAAAAAAwAAQ4AAAAAPAAAADnNwZW5kaW5nX2xpbWl0AAAAAAAKAAAAAAAAAAAAAAAukO3QAAAAAA8AAAAFdG9rZW4AAAAAAAASAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5h";

describe("policy-link — DefaultInstallParams", () => {
  it("D2: hằng số trần cứng đúng cam kết (20.000 XLM / ~1 ngày ledger)", () => {
    expect(ONCHAIN_CAP_STROOPS).toBe(200_000_000_000n);
    expect(ONCHAIN_PERIOD_LEDGERS).toBe(17_280);
  });

  it("vector XDR khớp từng byte (canonical: period < spending < token)", () => {
    expect(spendingLimitInstallParamsScVal(SAC_TESTNET).toXDR("base64")).toBe(VECTOR_B64);
  });
});
