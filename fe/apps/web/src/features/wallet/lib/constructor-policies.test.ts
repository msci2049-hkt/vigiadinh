// GHIM map policies GHÉP 2 entry — đúng lỗ hổng sự cố 30/07: policy-link.test
// và recovery-link.test ghim TỪNG entry riêng lẻ nên map ghép sai thứ tự vẫn
// xanh CI mà chết trên chain ("ScMap was not sorted by key for conversion to
// host object"). Vector dưới = map [spending-limit CCIN…, registry CDGB…]
// ĐÚNG thứ tự host — simulate testnet 30/07 xác nhận: thứ tự này OK, thứ tự
// ngược bị host chối. Thêm policy thứ 3 mà quên qua sortConstructorPolicies
// (hoặc đổi công thức entry) là test này đỏ ngay.
import { Address, xdr } from "@stellar/stellar-sdk";
import type { PolicyConfig } from "smart-account-kit";
import { describe, expect, it } from "vitest";
import { sortConstructorPolicies } from "./constructor-policies";
import { spendingLimitInstallParamsScVal } from "./policy-link";
import { recoveryRegistryEntryScVal } from "./recovery-link";

// Bộ giá trị production testnet 07-29 — trùng env đã bake (env-*.js) và trùng
// literal ở policy-link.test.ts để hai tầng ghim nói về CÙNG một thế giới.
const REGISTRY = "CDGBHEXSPNO4CJHYSSV4FZBN3C7XXQOPZPDATR65SH5QHRCDB2WL4JIR";
const POLICY = "CCIN4CP4HAFNDBSS7ZILGKBTUNC2TDAMFCLSI7E2TW44SJ7R7FTSFJZK";
const SAC_TESTNET = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const COMBINED_MAP_VECTOR_B64 =
  "AAAAEQAAAAEAAAACAAAAEgAAAAGQ3gn8OArRhlL+ULMoM6NFqYwMKJckfJqduckn8flnIgAAABEAAAABAAAAAwAAAA8AAAAOcGVyaW9kX2xlZGdlcnMAAAAAAAMAAEOAAAAADwAAAA5zcGVuZGluZ19saW1pdAAAAAAACgAAAAAAAAAAAAAALpDt0AAAAAAPAAAABXRva2VuAAAAAAAAEgAAAAHXkotywnA8z+r365/0701QSlWouXn8m0UOoshCtNHOYQAAABIAAAABzBOS8ntdwST4lKvC5C3Yv3vBz8vGCcfdkfsDxEMOrL4AAAAQAAAAAQAAAAIAAAAPAAAAEFJlY292ZXJ5UmVnaXN0cnkAAAAFAAAAAAABUYA=";

/** Đúng thứ tự chèn của create-wallet.ts: registry trước, spending-limit sau. */
function insertionOrderPolicies(): PolicyConfig[] {
  return [
    { address: REGISTRY, type: "custom", installParams: recoveryRegistryEntryScVal(86400) },
    {
      address: POLICY,
      type: "custom",
      installParams: spendingLimitInstallParamsScVal(SAC_TESTNET),
    },
  ];
}

/** installParams của đường "custom" LUÔN là ScVal — ném thay vì cast mù. */
function installScVal(policy: PolicyConfig): xdr.ScVal {
  if (!(policy.installParams instanceof xdr.ScVal)) {
    throw new Error(`installParams của ${policy.address} không phải xdr.ScVal`);
  }
  return policy.installParams;
}

describe("constructor-policies — thứ tự host của map policies", () => {
  it("đảo [registry CDGB…, policy CCIN…] về [CCIN…, CDGB…] (hash 90de… < cc13…)", () => {
    const sorted = sortConstructorPolicies(insertionOrderPolicies());
    expect(sorted.map((p) => p.address)).toEqual([POLICY, REGISTRY]);
  });

  it("không đụng mảng gốc (trả bản sao)", () => {
    const input = insertionOrderPolicies();
    sortConstructorPolicies(input);
    expect(input.map((p) => p.address)).toEqual([REGISTRY, POLICY]);
  });

  it("map GHÉP 2 entry khớp vector XDR từng byte — thứ tự mà host nhận", () => {
    // Dựng ScMap đúng cách kit encode (key = Address.toScVal, val = installParams
    // giữ nguyên) từ output của sortConstructorPolicies — ghim CẢ thứ tự CẢ nội dung.
    const entries = sortConstructorPolicies(insertionOrderPolicies()).map(
      (p) =>
        new xdr.ScMapEntry({
          key: new Address(p.address).toScVal(),
          val: installScVal(p),
        }),
    );
    expect(xdr.ScVal.scvMap(entries).toXDR("base64")).toBe(COMBINED_MAP_VECTOR_B64);
  });
});
