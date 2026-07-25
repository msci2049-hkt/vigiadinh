// Test tầng Stellar (PHA 5.1) — phần THUẦN: fee-bump giữ nguyên tx user, ví phí
// chỉ ký lớp ngoài; ví phí chưa cấu hình → lỗi rõ (không silent).
// (buildInvokeTx/submit chạm mạng — bằng chứng sống nằm ở smoke script, BUILD-LOG.)
import { describe, expect, it } from "bun:test";
import {
  Account,
  BASE_FEE,
  FeeBumpTransaction,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { env } from "@/env";
import {
  assertFeeWithinCap,
  buildFeeBumpXdr,
  feeWallet,
  StellarServiceError,
} from "./stellar.service";

const userKey = Keypair.random();
const bumper = Keypair.random();

function signedUserTx(): string {
  const tx = new TransactionBuilder(new Account(userKey.publicKey(), "7"), {
    fee: BASE_FEE,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.bumpSequence({ bumpTo: "9" }))
    .setTimeout(300)
    .build();
  tx.sign(userKey);
  return tx.toXDR();
}

describe("stellar service (thuần)", () => {
  it("fee-bump: lớp ngoài do VÍ PHÍ ký, envelope + chữ ký user NGUYÊN VẸN", () => {
    const innerXdr = signedUserTx();
    const outerXdr = buildFeeBumpXdr(innerXdr, bumper);

    const outer = TransactionBuilder.fromXDR(outerXdr, env.STELLAR_NETWORK_PASSPHRASE);
    expect(outer).toBeInstanceOf(FeeBumpTransaction);
    const bump = outer as FeeBumpTransaction;
    expect(bump.feeSource).toBe(bumper.publicKey());
    // Tx trong giữ nguyên từng byte (chữ ký user không bị đụng).
    expect(bump.innerTransaction.toXDR()).toBe(innerXdr);
    // Ví phí KHÔNG phải là user — tách custody.
    expect(bump.feeSource).not.toBe(userKey.publicKey());
  });

  it("fee-bump chồng fee-bump → ALREADY_FEE_BUMPED", () => {
    const once = buildFeeBumpXdr(signedUserTx(), bumper);
    expect(() => buildFeeBumpXdr(once, bumper)).toThrow(StellarServiceError);
  });

  it("ví phí chưa cấu hình → FEE_WALLET_NOT_CONFIGURED (route map 503)", () => {
    if (env.FEE_WALLET_SECRET) {
      // Máy dev đã cấu hình — chỉ khẳng định feeWallet() trả đúng account.
      expect(feeWallet().publicKey()).toMatch(/^G[A-Z2-7]{55}$/);
    } else {
      expect(() => feeWallet()).toThrow("FEE_WALLET_NOT_CONFIGURED");
    }
  });

  // B-SEC-3: trần phí chặn cost-attack qua contract do người dùng khai.
  describe("assertFeeWithinCap", () => {
    it("phí trong trần → cho qua", () => {
      expect(() => assertFeeWithinCap("100000", 5_000_000)).not.toThrow();
    });

    it("phí vượt trần → FEE_CAP_EXCEEDED (chặn TRƯỚC khi ví phí ký)", () => {
      expect(() => assertFeeWithinCap("9000000", 5_000_000)).toThrow(StellarServiceError);
      expect(() => assertFeeWithinCap("9000000", 5_000_000)).toThrow("FEE_CAP_EXCEEDED");
    });

    it("không truyền trần → không chặn (đường khác giữ nguyên hành vi)", () => {
      expect(() => assertFeeWithinCap("999999999", undefined)).not.toThrow();
    });

    it("fee không phải số hữu hạn → chặn (fail-closed)", () => {
      expect(() => assertFeeWithinCap("not-a-number", 5_000_000)).toThrow(StellarServiceError);
    });
  });
});
