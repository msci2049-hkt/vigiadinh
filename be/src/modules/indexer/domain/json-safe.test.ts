// GÁC sự cố 2026-07-30: một event `register` hợp lệ (`[2, 86400n]`) làm indexer
// chết cứng 48 phút vì BigInt không serialize được vào jsonb. Test này khẳng
// định hai điều: (1) không còn BigInt nào sót lại ở bất kỳ độ sâu nào,
// (2) JSON.stringify — đúng thứ postgres-js gọi — KHÔNG throw.
import { describe, expect, it } from "bun:test";
import { toJsonSafe } from "./json-safe";

/** Đúng nguồn lỗi thật: JSON.stringify là chỗ postgres-js chết. */
function serializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

describe("toJsonSafe — BigInt → string (mất kiểu, KHÔNG mất chữ số)", () => {
  it("BigInt trần thành string", () => {
    expect(toJsonSafe(86400n)).toBe("86400");
    expect(toJsonSafe(0n)).toBe("0");
    expect(toJsonSafe(-1n)).toBe("-1");
  });

  it("event register THẬT của sự cố: value [2, 86400n]", () => {
    const value = toJsonSafe([2, 86400n]);
    expect(value).toEqual([2, "86400"]);
    expect(serializable(value)).toBe(true);
    // Trước khi vá, đúng dòng này throw:
    expect(serializable([2, 86400n])).toBe(false);
  });

  it("KHÔNG mất chữ số với số vượt 2^53 — lý do chọn string thay vì Number", () => {
    // 2^53 = 9007199254740992. Number(9007199254740993n) = ...992 (SAI 1 đơn vị).
    const big = 9_007_199_254_740_993n;
    expect(toJsonSafe(big)).toBe("9007199254740993");
    expect(Number(big).toString()).not.toBe("9007199254740993"); // bằng chứng vì sao không dùng Number
    // amount stroops thật của một ví lớn (10^18 stroop = 10^11 XLM).
    expect(toJsonSafe(1_000_000_000_000_000_000n)).toBe("1000000000000000000");
  });

  it("array lồng array, BigInt sâu 3 tầng", () => {
    const input = { a: [{ b: [{ c: 7n }] }] };
    expect(toJsonSafe(input)).toEqual({ a: [{ b: [{ c: "7" }] }] });
    expect(serializable(toJsonSafe(input))).toBe(true);
  });

  it("shape data THẬT của simplifyEvent — topics + value + txHash", () => {
    const data = {
      topics: ["register", "G".repeat(56)],
      value: [2, 86400n],
      txHash: "a".repeat(64),
    };
    expect(serializable(data)).toBe(false); // trước khi vá
    const safe = toJsonSafe(data);
    expect(serializable(safe)).toBe(true);
    expect(safe).toEqual({
      topics: ["register", "G".repeat(56)],
      value: [2, "86400"],
      txHash: "a".repeat(64),
    });
  });

  it("BigInt sâu trong Map-của-contract (scValToNative trả object thường)", () => {
    const input = { limits: { perTx: 5_000_000_000n, daily: { max: 10n, tier: 1 } } };
    expect(toJsonSafe(input)).toEqual({
      limits: { perTx: "5000000000", daily: { max: "10", tier: 1 } },
    });
  });

  it("giữ NGUYÊN Uint8Array — mirror recovery nhận fingerprint bằng instanceof", () => {
    const fingerprint = new Uint8Array(32).fill(0xab);
    const out = toJsonSafe({ value: ["G".repeat(56), fingerprint] }) as {
      value: [string, unknown];
    };
    expect(out.value[1]).toBeInstanceOf(Uint8Array);
    expect(out.value[1]).toBe(fingerprint); // cùng một thân, không copy từng byte
  });

  it("giá trị thường đi qua không sứt: string/number/boolean/null/undefined", () => {
    expect(toJsonSafe("x")).toBe("x");
    expect(toJsonSafe(42)).toBe(42);
    expect(toJsonSafe(false)).toBe(false);
    expect(toJsonSafe(null)).toBe(null);
    expect(toJsonSafe(undefined)).toBe(undefined);
    expect(toJsonSafe([])).toEqual([]);
    expect(toJsonSafe({})).toEqual({});
  });
});
