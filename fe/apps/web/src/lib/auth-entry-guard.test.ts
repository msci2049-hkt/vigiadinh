// Test HỒI QUY cho lỗ hổng ký mù (audit 2026-07-25, P0-1).
//
// Trước khi vá: mọi màn ký (trừ guardian/initiate) đưa thẳng entry backend trả
// về cho passkey ký, chỉ kiểm địa chỉ credentials. Backend bị chiếm đổi
// `to`/`amount` là người dùng tự tay ký lệnh rút sạch ví.
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import {
  assertAddGuardianEntry,
  assertApproveRecoveryEntry,
  assertCancelRecoveryEntry,
  assertMethodOnly,
  assertRegisterWalletEntry,
  assertTransferEntry,
  BlindSignError,
} from "./auth-entry-guard";

// Địa chỉ contract CỐ ĐỊNH (hợp lệ, sinh từ buffer đều) — `Keypair.random()`
// chết dưới jsdom vì noble/ed25519 không nhận getRandomValues của jsdom.
const SAC = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";
const REGISTRY = "CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ";
const WALLET = "CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3";
const FRIEND = "CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW";
const ATTACKER = "CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U";
const OTHER = "CADAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMSST";

function entry(
  contract: string,
  method: string,
  args: xdr.ScVal[],
  subInvocations: xdr.SorobanAuthorizedInvocation[] = [],
): string {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(contract).toScAddress(),
        functionName: method,
        args,
      }),
    ),
    subInvocations,
  });
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(WALLET).toScAddress(),
        nonce: xdr.Int64.fromString("1"),
        signatureExpirationLedger: 100,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocation,
  }).toXDR("base64");
}

const addr = (a: string) => nativeToScVal(new Address(a));
const amount = (v: bigint) => nativeToScVal(v, { type: "i128" });

function transferEntry(to: string, value: bigint, contract = SAC): string {
  return entry(contract, "transfer", [addr(WALLET), addr(to), amount(value)]);
}

describe("assertTransferEntry — chống tráo nội dung lệnh gửi tiền", () => {
  const expected = { sac: SAC, from: WALLET, to: FRIEND, amount: 1_000_000n };

  it("entry đúng thứ người dùng nhập → cho ký", () => {
    expect(() => assertTransferEntry(transferEntry(FRIEND, 1_000_000n), expected)).not.toThrow();
  });

  it("tráo NGƯỜI NHẬN → chặn trước khi ký", () => {
    expect(() => assertTransferEntry(transferEntry(ATTACKER, 1_000_000n), expected)).toThrow(
      BlindSignError,
    );
  });

  it("tráo SỐ TIỀN → chặn trước khi ký", () => {
    expect(() => assertTransferEntry(transferEntry(FRIEND, 999_999_999_999n), expected)).toThrow(
      BlindSignError,
    );
  });

  it("tráo CONTRACT (token khác) → chặn", () => {
    expect(() => assertTransferEntry(transferEntry(FRIEND, 1_000_000n, OTHER), expected)).toThrow(
      BlindSignError,
    );
  });

  it("đổi hẳn sang hàm khác → chặn", () => {
    const evil = entry(SAC, "burn", [addr(WALLET), amount(1_000_000n)]);
    expect(() => assertTransferEntry(evil, expected)).toThrow(BlindSignError);
  });

  it("giấu lệnh thật trong sub-invocation → chặn", () => {
    const hidden = new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(SAC).toScAddress(),
          functionName: "transfer",
          args: [addr(WALLET), addr(ATTACKER), amount(999_999n)],
        }),
      ),
      subInvocations: [],
    });
    const evil = entry(SAC, "transfer", [addr(WALLET), addr(FRIEND), amount(1_000_000n)], [hidden]);
    expect(() => assertTransferEntry(evil, expected)).toThrow(BlindSignError);
  });
});

describe("assertMethodOnly — challenge đăng nhập không được là máy ký thuê", () => {
  it("web_auth_verify → cho ký", () => {
    const ok = entry(REGISTRY, "web_auth_verify", []);
    expect(() => assertMethodOnly(ok, "web_auth_verify")).not.toThrow();
  });

  it("challenge chứa lệnh transfer → chặn", () => {
    expect(() => assertMethodOnly(transferEntry(ATTACKER, 999n), "web_auth_verify")).toThrow(
      BlindSignError,
    );
  });
});

describe("assertAddGuardianEntry — thêm đúng người vừa mời", () => {
  const expected = { registry: REGISTRY, wallet: WALLET, guardian: FRIEND };

  it("đúng địa chỉ đã mời → cho ký", () => {
    const ok = entry(REGISTRY, "add_guardian", [addr(WALLET), addr(FRIEND)]);
    expect(() => assertAddGuardianEntry(ok, expected)).not.toThrow();
  });

  it("tráo sang địa chỉ kẻ lạ → chặn", () => {
    const evil = entry(REGISTRY, "add_guardian", [addr(WALLET), addr(ATTACKER)]);
    expect(() => assertAddGuardianEntry(evil, expected)).toThrow(BlindSignError);
  });
});

describe("assertRegisterWalletEntry — đăng ký chỉ một lần, sai là hỏng vĩnh viễn", () => {
  const expected = {
    registry: REGISTRY,
    wallet: WALLET,
    allowedGuardians: [FRIEND],
    threshold: 2,
    timelockSecs: 86_400,
  };

  function registerEntry(guardians: string[], threshold: number, timelock: number): string {
    return entry(REGISTRY, "register_wallet", [
      addr(WALLET),
      xdr.ScVal.scvVec(guardians.map(addr)),
      nativeToScVal(threshold, { type: "u32" }),
      nativeToScVal(timelock, { type: "u64" }),
    ]);
  }

  it("đúng cấu hình đang hiện trên màn → cho ký", () => {
    expect(() =>
      assertRegisterWalletEntry(registerEntry([FRIEND], 2, 86_400), expected),
    ).not.toThrow();
  });

  it("nhét địa chỉ chủ ví CHƯA từng thấy vào danh sách → chặn", () => {
    expect(() =>
      assertRegisterWalletEntry(registerEntry([FRIEND, ATTACKER], 2, 86_400), expected),
    ).toThrow(BlindSignError);
  });

  it("hạ ngưỡng xuống 1 → chặn", () => {
    expect(() => assertRegisterWalletEntry(registerEntry([FRIEND], 1, 86_400), expected)).toThrow(
      BlindSignError,
    );
  });

  it("xoá thời gian chờ (timelock = 0) → chặn", () => {
    expect(() => assertRegisterWalletEntry(registerEntry([FRIEND], 2, 0), expected)).toThrow(
      BlindSignError,
    );
  });
});

// B-SEC-5: hai màn ghi cuối cùng còn ký mù — guardian/approve + block/confirm.
describe("assertApproveRecoveryEntry — duyệt khôi phục không được thành lệnh rút ví", () => {
  const expected = { registry: REGISTRY, wallet: WALLET };

  it("approve_recovery đúng ví → cho ký", () => {
    const ok = entry(REGISTRY, "approve_recovery", [addr(WALLET), addr(FRIEND)]);
    expect(() => assertApproveRecoveryEntry(ok, expected)).not.toThrow();
  });

  it("backend tráo entry transfer TỪ ví người bảo hộ → chặn TRƯỚC passkey", () => {
    expect(() => assertApproveRecoveryEntry(transferEntry(ATTACKER, 999_999n), expected)).toThrow(
      BlindSignError,
    );
  });

  it("duyệt NHẦM ví khác (backend đổi wallet arg) → chặn", () => {
    const evil = entry(REGISTRY, "approve_recovery", [addr(OTHER), addr(FRIEND)]);
    expect(() => assertApproveRecoveryEntry(evil, expected)).toThrow(BlindSignError);
  });

  it("kiểm guardian arg khi truyền tường minh → tráo guardian bị chặn", () => {
    const evil = entry(REGISTRY, "approve_recovery", [addr(WALLET), addr(ATTACKER)]);
    expect(() => assertApproveRecoveryEntry(evil, { ...expected, guardian: FRIEND })).toThrow(
      BlindSignError,
    );
  });
});

describe("assertCancelRecoveryEntry — màn đóng ví không được để transfer lọt qua", () => {
  const expected = { registry: REGISTRY, wallet: WALLET };

  it("cancel_recovery đúng ví → cho ký", () => {
    const ok = entry(REGISTRY, "cancel_recovery", [addr(WALLET)]);
    expect(() => assertCancelRecoveryEntry(ok, expected)).not.toThrow();
  });

  it("entry transfer đội lốt veto → chặn", () => {
    expect(() => assertCancelRecoveryEntry(transferEntry(ATTACKER, 999_999n), expected)).toThrow(
      BlindSignError,
    );
  });

  it("veto NHẦM ví khác → chặn", () => {
    const evil = entry(REGISTRY, "cancel_recovery", [addr(OTHER)]);
    expect(() => assertCancelRecoveryEntry(evil, expected)).toThrow(BlindSignError);
  });
});
