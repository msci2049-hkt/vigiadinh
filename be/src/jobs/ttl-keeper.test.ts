// Test mục F (MAINNET-CHECKLIST.md): các entry hạ tầng — origin-verifier,
// web-auth, registry (instance) + WASM code (khám phá qua RPC + smart-account
// từ env) — PHẢI nằm trong vòng gia hạn của ttl-keeper. Hermetic: deps tiêm
// fake, không mạng; giải mã ngược xdr.LedgerKey để chứng minh key đúng contract.
import { afterAll, describe, expect, test } from "bun:test";
import { Address, StrKey, xdr } from "@stellar/stellar-sdk";
import { env } from "@/env";
import { collectInfraTtlTargets, extendInfraTtl, type InfraTtlTarget } from "./ttl-keeper";

// Contract id CÔNG KHAI (testnet dev, chỉ làm fixture strkey hợp lệ).
const ORIGIN_VERIFIER = "CCNS6O5HBTF7XOOVCNF4XLTKORQ4JB4PKUKUA6CX2MW7OXOKGKKC2O4N";
const WEB_AUTH = "CAKV3MKK3WA2CJX56LA52YYAG7FDMQTD7ZYRT3FKXUOCOEXZIANG2SST";
const REGISTRY = "CAFU4CZNPN5YWFV3QOCA4Y6FSJUB7IGI456MIGTQRJXA4DQLWUIHFMCO";
const ACCOUNT_WASM = "78e7521f391123c2dc119bdf2c3ecae1a4655fbf360e5c2a17fd12be028da170";
const WEB_AUTH_WASM = "a".repeat(64);

type MutableEnv = {
  CONTRACT_ID_ORIGIN_VERIFIER?: string;
  SEP45_WEB_AUTH_CONTRACT_ID?: string;
  CONTRACT_ID_RECOVERY?: string;
  ACCOUNT_WASM_HASH?: string;
};
const mutableEnv = env as MutableEnv;
const saved: MutableEnv = {
  CONTRACT_ID_ORIGIN_VERIFIER: env.CONTRACT_ID_ORIGIN_VERIFIER,
  SEP45_WEB_AUTH_CONTRACT_ID: env.SEP45_WEB_AUTH_CONTRACT_ID,
  CONTRACT_ID_RECOVERY: env.CONTRACT_ID_RECOVERY,
  ACCOUNT_WASM_HASH: env.ACCOUNT_WASM_HASH,
};
afterAll(() => {
  Object.assign(mutableEnv, saved);
});

/** Giải mã ngược một target về dạng người đọc: instance→contractId, code→hashHex. */
function decode(target: InfraTtlTarget): { label: string; value: string } {
  const key = target.key;
  if (key.switch() === xdr.LedgerEntryType.contractData()) {
    const contractId = Address.fromScAddress(key.contractData().contract()).toString();
    expect(key.contractData().durability()).toEqual(xdr.ContractDataDurability.persistent());
    return { label: target.label, value: contractId };
  }
  return { label: target.label, value: key.contractCode().hash().toString("hex") };
}

describe("collectInfraTtlTargets (F) — danh sách entry hạ tầng theo env", () => {
  test("đủ env → 3 instance + 3 code (khám phá RPC) + 1 code smart-account", async () => {
    Object.assign(mutableEnv, {
      CONTRACT_ID_ORIGIN_VERIFIER: ORIGIN_VERIFIER,
      SEP45_WEB_AUTH_CONTRACT_ID: WEB_AUTH,
      CONTRACT_ID_RECOVERY: REGISTRY,
      ACCOUNT_WASM_HASH: ACCOUNT_WASM,
    });
    let askedIds: string[] = [];
    const targets = await collectInfraTtlTargets({
      wasmHashHexOf: async (ids) => {
        askedIds = ids;
        // RPC chỉ biết hash của web-auth (origin-verifier/registry coi như chưa
        // đọc được) → code entry chỉ sinh cho contract CÓ hash.
        return new Map([[WEB_AUTH, WEB_AUTH_WASM]]);
      },
    });
    expect(askedIds).toEqual([ORIGIN_VERIFIER, WEB_AUTH, REGISTRY]);
    const decoded = targets.map(decode);
    expect(decoded).toEqual([
      { label: "origin-verifier:instance", value: ORIGIN_VERIFIER },
      { label: "web-auth:instance", value: WEB_AUTH },
      { label: "recovery-registry:instance", value: REGISTRY },
      { label: "web-auth:code", value: WEB_AUTH_WASM },
      { label: "smart-account:code", value: ACCOUNT_WASM },
    ]);
    // Mọi contract id trong key phải là strkey hợp lệ (Address round-trip đã ép).
    expect(StrKey.isValidContract(ORIGIN_VERIFIER)).toBe(true);
  });

  test("env trống → 0 target, không gọi RPC vô ích", async () => {
    Object.assign(mutableEnv, {
      CONTRACT_ID_ORIGIN_VERIFIER: undefined,
      SEP45_WEB_AUTH_CONTRACT_ID: undefined,
      CONTRACT_ID_RECOVERY: undefined,
      ACCOUNT_WASM_HASH: undefined,
    });
    const targets = await collectInfraTtlTargets({
      wasmHashHexOf: async (ids) => {
        expect(ids).toEqual([]);
        return new Map();
      },
    });
    expect(targets).toEqual([]);
  });
});

describe("extendInfraTtl (F) — cách ly lỗi từng target", () => {
  test("một target hỏng không làm hỏng lượt của target khác; đếm đúng", async () => {
    Object.assign(mutableEnv, {
      CONTRACT_ID_ORIGIN_VERIFIER: ORIGIN_VERIFIER,
      SEP45_WEB_AUTH_CONTRACT_ID: WEB_AUTH,
      CONTRACT_ID_RECOVERY: undefined,
      ACCOUNT_WASM_HASH: ACCOUNT_WASM,
    });
    const extendedKeys: xdr.LedgerKey[][] = [];
    let call = 0;
    const result = await extendInfraTtl({
      wasmHashHexOf: async () => new Map(),
      extend: async (keys) => {
        call += 1;
        // Target thứ 2 (web-auth:instance) giả lập "chưa deploy" → simulate fail.
        if (call === 2) throw new Error("SIMULATION_FAILED:entry missing");
        extendedKeys.push(keys);
      },
    });
    // 3 target (2 instance + smart-account:code): 1 fail, 2 extended.
    expect(result).toEqual({ extended: 2, failed: 1 });
    expect(extendedKeys).toHaveLength(2);
    // Mỗi tx đúng MỘT key — lỗi target nào chỉ rơi target đó.
    for (const keys of extendedKeys) expect(keys).toHaveLength(1);
  });

  test("wasmHashHexOf sập (RPC chết) → failed=1, không throw ra cron", async () => {
    Object.assign(mutableEnv, {
      CONTRACT_ID_ORIGIN_VERIFIER: ORIGIN_VERIFIER,
      SEP45_WEB_AUTH_CONTRACT_ID: undefined,
      CONTRACT_ID_RECOVERY: undefined,
      ACCOUNT_WASM_HASH: undefined,
    });
    const result = await extendInfraTtl({
      wasmHashHexOf: async () => {
        throw new Error("rpc down");
      },
      extend: async () => {
        throw new Error("không được gọi tới đây");
      },
    });
    expect(result).toEqual({ extended: 0, failed: 1 });
  });
});
