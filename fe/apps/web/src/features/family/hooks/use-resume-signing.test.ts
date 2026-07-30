// Test máy KÝ TIẾP lệnh đã được người thân duyệt (lô vá L2).
//
// Ba điều phải giữ, theo đúng thứ tự ưu tiên:
// 1. CHỐNG KÝ MÙ vẫn chạy ở đường này. Lệnh không do người dùng vừa gõ, nhưng
//    entry `/signable` trả về vẫn phải khớp thứ ĐANG HIỆN trên màn — tráo người
//    nhận hay số tiền là chặn TRƯỚC khi passkey mở, không gọi ký.
// 2. Thiếu dữ kiện đối chiếu = CHỐI, không "tạm cho qua".
// 3. Đường sạch thì ký + nộp và trả hash.
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlindSignError } from "@/lib/auth-entry-guard";
import { getSignable, signSend } from "../api/send";
import { useResumeSigning } from "./use-resume-signing";

// Địa chỉ contract CỐ ĐỊNH hợp lệ (Keypair.random chết dưới jsdom — noble/ed25519
// không nhận getRandomValues của jsdom; khuôn use-send-machine.test).
const SAC = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";
const WALLET = "CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3";
const FRIEND = "CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW";
const ATTACKER = "CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U";

vi.mock("../api/send", () => ({
  getSignable: vi.fn(),
  signSend: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: { VITE_SAC_NATIVE: "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526" },
}));

function transferEntry(to: string, value: bigint): string {
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: new Address(SAC).toScAddress(),
        functionName: "transfer",
        args: [
          nativeToScVal(new Address(WALLET)),
          nativeToScVal(new Address(to)),
          nativeToScVal(value, { type: "i128" }),
        ],
      }),
    ),
    subInvocations: [],
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

/** Thứ ĐANG HIỆN trên màn — máy ký phải chốt entry vào đúng bộ này. */
const TARGET = {
  intentId: "i-approved",
  from: WALLET,
  recipient: FRIEND,
  amountStroops: "1000000",
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function signableWith(entries: string[]) {
  vi.mocked(getSignable).mockResolvedValue({
    intentId: TARGET.intentId,
    transactionXdr: "AAA",
    authEntriesXdr: entries,
    latestLedger: 100,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useResumeSigning — chống ký mù còn nguyên ở đường ký tiếp", () => {
  it("entry TRÁO NGƯỜI NHẬN → chặn TRƯỚC passkey, không gọi ký, không nộp", async () => {
    signableWith([transferEntry(ATTACKER, 1_000_000n)]);
    const signEntries = vi.fn().mockResolvedValue(["signed"]);
    const { result } = renderHook(() => useResumeSigning({ signEntries }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.run(TARGET);
    });

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.error).toBeInstanceOf(BlindSignError);
    expect((result.current.error as BlindSignError).code).toBe("ENTRY_WRONG_RECIPIENT");
    expect(signEntries).not.toHaveBeenCalled();
    expect(signSend).not.toHaveBeenCalled();
  });

  it("entry TRÁO SỐ TIỀN → chặn, không gọi ký", async () => {
    signableWith([transferEntry(FRIEND, 999_000_000n)]);
    const signEntries = vi.fn().mockResolvedValue(["signed"]);
    const { result } = renderHook(() => useResumeSigning({ signEntries }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.run(TARGET);
    });

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect((result.current.error as BlindSignError).code).toBe("ENTRY_WRONG_AMOUNT");
    expect(signEntries).not.toHaveBeenCalled();
  });

  it("thiếu dữ kiện đối chiếu (recipient null) → CHỐI, không ký bừa", async () => {
    signableWith([transferEntry(FRIEND, 1_000_000n)]);
    const signEntries = vi.fn().mockResolvedValue(["signed"]);
    const { result } = renderHook(() => useResumeSigning({ signEntries }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.run({ ...TARGET, recipient: null });
    });

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.error).toBeInstanceOf(BlindSignError);
    expect(signEntries).not.toHaveBeenCalled();
  });

  it("entry KHỚP → ký + nộp → settled kèm hash", async () => {
    signableWith([transferEntry(FRIEND, 1_000_000n)]);
    const signEntries = vi.fn().mockResolvedValue(["signed-entry"]);
    vi.mocked(signSend).mockResolvedValue({
      intentId: TARGET.intentId,
      status: "settled",
      hash: "abc123",
    });
    const { result } = renderHook(() => useResumeSigning({ signEntries }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.run(TARGET);
    });

    await waitFor(() => expect(result.current.phase).toBe("settled"));
    expect(result.current.txHash).toBe("abc123");
    expect(signEntries).toHaveBeenCalledWith({
      entriesXdr: [transferEntry(FRIEND, 1_000_000n)],
      latestLedger: 100,
    });
    expect(signSend).toHaveBeenCalledWith({
      intentId: TARGET.intentId,
      signedEntriesXdr: ["signed-entry"],
    });
  });

  it("nộp lỗi → failed, KHÔNG nuốt lỗi (danh sách chờ ký là nguồn sự thật)", async () => {
    signableWith([transferEntry(FRIEND, 1_000_000n)]);
    const signEntries = vi.fn().mockResolvedValue(["signed-entry"]);
    vi.mocked(signSend).mockRejectedValue(new Error("BOOM"));
    const { result } = renderHook(() => useResumeSigning({ signEntries }), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      await result.current.run(TARGET);
    });

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.txHash).toBeNull();
  });
});
