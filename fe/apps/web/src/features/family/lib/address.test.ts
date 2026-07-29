// §5 LÔ 4 — validate địa chỉ: C ok · G ok · M nhận diện đúng (không gửi được
// qua pipeline hiện tại) · rác/sai checksum bị chối.
import { Account, MuxedAccount } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { classifyAddress, isSendableAddress, shortAddress } from "./address";

// Địa chỉ thật trên testnet (công khai) — C có CHECKSUM đúng.
const CONTRACT = "CD5QX3XLAKQA2AVP62ZTI5REDAWDO2D2WOVGJGM7LZCKSOFRGYSE7AJT";
const CLASSIC = "GB4RZN2ZBZ6TS5SY45XE7R7DHX4HLNGHVJGJOMCIYQSMMY2AGT3CECWU";
// Muxed sinh bằng CHÍNH SDK (G thật + id) — không hardcode chuỗi chép tay.
const MUXED = new MuxedAccount(new Account(CLASSIC, "0"), "12345").accountId();

describe("classifyAddress", () => {
  it("C… (ví hợp đồng) → contract, gửi được", () => {
    expect(classifyAddress(CONTRACT)).toBe("contract");
    expect(isSendableAddress(CONTRACT)).toBe(true);
  });

  it("G… (classic) → classic, gửi được", () => {
    expect(classifyAddress(CLASSIC)).toBe("classic");
    expect(isSendableAddress(CLASSIC)).toBe(true);
  });

  it("M… (muxed) → nhận diện ĐÚNG là muxed nhưng KHÔNG gửi qua pipeline", () => {
    expect(classifyAddress(MUXED)).toBe("muxed");
    expect(isSendableAddress(MUXED)).toBe(false);
  });

  it("rác + sai checksum → invalid (regex cũ [GC]{55} cho qua là bug)", () => {
    expect(classifyAddress("khong-phai-dia-chi")).toBe("invalid");
    expect(classifyAddress("")).toBe("invalid");
    // Đổi ký tự cuối của một địa chỉ C thật → checksum sai → PHẢI chối.
    const corrupted = `${CONTRACT.slice(0, -1)}${CONTRACT.endsWith("A") ? "B" : "A"}`;
    expect(classifyAddress(corrupted)).toBe("invalid");
    expect(isSendableAddress(corrupted)).toBe(false);
  });

  it("cắt khoảng trắng khi dán", () => {
    expect(classifyAddress(`  ${CONTRACT}\n`)).toBe("contract");
  });
});

describe("shortAddress", () => {
  it("rút gọn giữ 6 ký tự hai đầu", () => {
    expect(shortAddress(CONTRACT)).toBe("CD5QX3…SE7AJT");
  });
});
