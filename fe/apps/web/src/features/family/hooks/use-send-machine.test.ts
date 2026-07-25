// Test máy XÁC NHẬN→KÝ→NỘP (WP3 fe-smooth) — 3 luật tiền phải giữ:
// 1. Mạng đứt SAU khi nộp ≠ thất bại: vào `unconfirmed`, KHÔNG cho retry, tự
//    đối chiếu audit tới khi ra kết cục thật (QA mục 8).
// 2. Guard chống ký mù chạy TRƯỚC passkey với input CỤC BỘ — entry bị tráo
//    (kể cả sau pre-warm) thì chặn, không gọi ký (§5 audit P0).
// 3. Thất bại TRƯỚC điểm nộp thì retry an toàn (tiền chưa đi đâu).

import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlindSignError } from "@/lib/auth-entry-guard";
import { confirmSend, type SendReview, signSend } from "../api/send";
import { DefiniteSubmitFailure, useSendMachine } from "./use-send-machine";

// Địa chỉ contract CỐ ĐỊNH hợp lệ (như auth-entry-guard.test — Keypair.random
// chết dưới jsdom vì noble/ed25519 không nhận getRandomValues của jsdom).
const SAC = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";
const WALLET = "CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3";
const FRIEND = "CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW";
const ATTACKER = "CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U";

vi.mock("../api/send", () => ({
  confirmSend: vi.fn(),
  signSend: vi.fn(),
}));
vi.mock("../api/audit", () => ({
  auditOptions: (walletId: string) => ({
    queryKey: ["test-audit", walletId],
    queryFn: () => auditFetch(),
  }),
}));
vi.mock("@/lib/env", () => ({
  env: { VITE_SAC_NATIVE: "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526" },
}));

const auditFetch = vi.fn<() => Promise<unknown[]>>();

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

const REVIEW: SendReview = {
  intentId: "i1",
  status: "review",
  from: WALLET,
  recipient: FRIEND,
  amount: "1000000",
  balance: "99000000",
};
const LOCAL = { recipient: FRIEND, amountStroops: "1000000" };
// Test timing: nhanh gấp ~500 lần thật để suite không chờ đồng hồ tường.
const FAST = { submitTimeoutMs: 500, pollEveryMs: 10, pollMax: 5 };

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function confirmedWith(entries: string[]) {
  vi.mocked(confirmSend).mockResolvedValue({
    intentId: "i1",
    status: "awaiting_signature",
    transactionXdr: "AAA",
    authEntriesXdr: entries,
    latestLedger: 100,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auditFetch.mockResolvedValue([]);
});

describe("useSendMachine — timeout ≠ thất bại (QA-8)", () => {
  it("mạng đứt sau khi nộp → unconfirmed (cấm retry) → audit settled → settled + hash", async () => {
    confirmedWith([transferEntry(FRIEND, 1_000_000n)]);
    const signEntries = vi.fn().mockResolvedValue(["signed"]);
    vi.mocked(signSend).mockRejectedValue(new TypeError("Failed to fetch"));
    auditFetch
      .mockResolvedValueOnce([]) // vòng 1: chưa thấy gì
      .mockResolvedValue([
        { kind: "intent.settled", payload: { intentId: "i1", hash: "HASH123" } },
      ]);

    const { result } = renderHook(
      () =>
        useSendMachine({
          walletId: "w1",
          walletAddress: WALLET,
          signEntries,
          // Poll thưa hơn FAST để waitFor kịp CHỨNG KIẾN trạng thái unconfirmed
          // trước khi audit trả kết cục (race của phép đo, không phải của máy).
          timing: { ...FAST, pollEveryMs: 200 },
        }),
      { wrapper: makeWrapper() },
    );
    void result.current.start(REVIEW, LOCAL);

    await waitFor(() => expect(result.current.phase).toBe("unconfirmed"));
    expect(result.current.canRetry).toBe(false); // KHÔNG có đường gửi lại

    await waitFor(() => expect(result.current.phase).toBe("settled"));
    expect(result.current.txHash).toBe("HASH123");
  });

  it("audit nói nộp TRƯỢT → failed với DefiniteSubmitFailure (làm lại từ đầu)", async () => {
    confirmedWith([transferEntry(FRIEND, 1_000_000n)]);
    vi.mocked(signSend).mockRejectedValue(new TypeError("Failed to fetch"));
    auditFetch.mockResolvedValue([{ kind: "intent.submit_failed", payload: { intentId: "i1" } }]);

    const { result } = renderHook(
      () =>
        useSendMachine({
          walletId: "w1",
          walletAddress: WALLET,
          signEntries: vi.fn().mockResolvedValue(["signed"]),
          timing: FAST,
        }),
      { wrapper: makeWrapper() },
    );
    void result.current.start(REVIEW, LOCAL);

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.error).toBeInstanceOf(DefiniteSubmitFailure);
  });

  it("poll cạn mà chưa có kết cục → vẫn unconfirmed + pollExhausted (không tự nhận thất bại)", async () => {
    confirmedWith([transferEntry(FRIEND, 1_000_000n)]);
    vi.mocked(signSend).mockRejectedValue(new TypeError("Failed to fetch"));
    auditFetch.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useSendMachine({
          walletId: "w1",
          walletAddress: WALLET,
          signEntries: vi.fn().mockResolvedValue(["signed"]),
          timing: FAST,
        }),
      { wrapper: makeWrapper() },
    );
    void result.current.start(REVIEW, LOCAL);

    await waitFor(() => expect(result.current.pollExhausted).toBe(true));
    expect(result.current.phase).toBe("unconfirmed");
    expect(result.current.canRetry).toBe(false);
  });
});

describe("useSendMachine — guard chống ký mù giữ nguyên sau pre-warm (§5)", () => {
  it("entry bị tráo người nhận → BlindSignError, passkey KHÔNG được gọi", async () => {
    confirmedWith([transferEntry(ATTACKER, 1_000_000n)]);
    const signEntries = vi.fn();

    const { result } = renderHook(
      () => useSendMachine({ walletId: "w1", walletAddress: WALLET, signEntries, timing: FAST }),
      { wrapper: makeWrapper() },
    );
    void result.current.start(REVIEW, LOCAL);

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.error).toBeInstanceOf(BlindSignError);
    expect(signEntries).not.toHaveBeenCalled();
    expect(signSend).not.toHaveBeenCalled();
  });

  it("người dùng đổi số tiền (input cục bộ mới ≠ entry cũ) → chặn, buộc build lại", async () => {
    // Mô phỏng ca §5: entry dựng cho 1_000_000 nhưng người dùng đã đổi thành
    // 2_000_000 — guard so với input HIỆN TẠI của màn nên phải chặn.
    confirmedWith([transferEntry(FRIEND, 1_000_000n)]);
    const signEntries = vi.fn();

    const { result } = renderHook(
      () => useSendMachine({ walletId: "w1", walletAddress: WALLET, signEntries, timing: FAST }),
      { wrapper: makeWrapper() },
    );
    void result.current.start(REVIEW, { recipient: FRIEND, amountStroops: "2000000" });

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.error).toBeInstanceOf(BlindSignError);
    expect(signEntries).not.toHaveBeenCalled();
  });
});

describe("useSendMachine — thất bại TRƯỚC điểm nộp thì retry an toàn", () => {
  it("confirm chết mạng → failed + canRetry", async () => {
    vi.mocked(confirmSend).mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(
      () =>
        useSendMachine({
          walletId: "w1",
          walletAddress: WALLET,
          signEntries: vi.fn(),
          timing: FAST,
        }),
      { wrapper: makeWrapper() },
    );
    void result.current.start(REVIEW, LOCAL);

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.canRetry).toBe(true);
    expect(signSend).not.toHaveBeenCalled();
  });

  it("vượt ngưỡng → awaiting_guardian, không ký gì", async () => {
    vi.mocked(confirmSend).mockResolvedValue({
      intentId: "i1",
      status: "awaiting_guardian",
      reasons: ["over_tx_limit"],
    });
    const signEntries = vi.fn();

    const { result } = renderHook(
      () => useSendMachine({ walletId: "w1", walletAddress: WALLET, signEntries, timing: FAST }),
      { wrapper: makeWrapper() },
    );
    void result.current.start(REVIEW, LOCAL);

    await waitFor(() => expect(result.current.phase).toBe("awaiting_guardian"));
    expect(signEntries).not.toHaveBeenCalled();
  });
});
