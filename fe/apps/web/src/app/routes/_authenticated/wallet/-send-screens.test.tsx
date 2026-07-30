// GÁC lỗi test tay 2026-07-30: ký-tiếp THÀNH CÔNG, tiền đi thật, mà UI nhảy về
// màn "Đang chờ người thân".
//
// Cơ chế của lỗi (và đúng thứ test này khoá lại): màn chờ chọn nhánh theo việc
// lệnh CÒN nằm trong `/pending-signature`. Ký xong BE thôi trả lệnh đó, và
// use-resume-signing invalidate cây ["family"] ngay sau khi ký → danh sách rỗng →
// `ready` undefined → rơi xuống nhánh cuối = màn chờ. Nói cách khác: chính cú
// refetch báo "đã xong" là cú xoá màn báo "đã xong".
//
// Ở đây máy ký được MOCK có chủ ý: đơn vị đang thử là NHÁNH RENDER của màn, còn
// bản thân máy ký (kể cả chống ký mù) đã có 5 ca riêng ở
// features/family/hooks/use-resume-signing.test.ts.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type PendingSignature,
  pendingSignatureKeys,
} from "@/features/family/api/pending-signature";
import type { useResumeSigning } from "@/features/family/hooks/use-resume-signing";
import i18n from "@/lib/i18n";

vi.mock("@tanstack/react-router", () => ({
  // <Button asChild> dùng Radix Slot → prop (kể cả data-testid) gộp xuống child.
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/wallet/lib/kit", () => ({
  ensureWalletConnected: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/wallet/lib/sign-wallet-entries", () => ({
  signWalletEntries: vi.fn(),
  WalletSignError: class WalletSignError extends Error {},
}));
vi.mock("@/features/family/hooks/use-resume-signing", () => ({
  useResumeSigning: vi.fn(),
}));

const { useResumeSigning: mockedUseResumeSigning } = await import(
  "@/features/family/hooks/use-resume-signing"
);
const { SendGuardianWaitScreen } = await import("./-send-screens");

const INTENT = "01KYRYHCX302N1750BRDTKN7FT";
const HASH = "2472ba62".padEnd(64, "0");

type Signing = ReturnType<typeof useResumeSigning>;

function signingState(over: Partial<Signing> = {}): Signing {
  return {
    phase: "idle",
    error: null,
    txHash: null,
    activeIntentId: null,
    busy: false,
    run: vi.fn(),
    reset: vi.fn(),
    ...over,
  } as Signing;
}

const item: PendingSignature = {
  intent_id: INTENT,
  wallet_id: "01KYRQ07WMTARAZFP7SFWJ8SP5",
  from: `C${"A".repeat(55)}`,
  amount: "6700000000", // 670 XLM
  recipient: "CBYKUIYA7LNNVQJCMKVG664R75V23YX5V4GHGIP5VTDVFDU6GW35SYDI",
  reasons: ["per_tx_limit"],
  created_at: "2026-07-30T16:50:00.000Z",
  expires_at: null,
};

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

beforeEach(() => {
  vi.mocked(mockedUseResumeSigning).mockReturnValue(signingState());
});

/** Cache seed thay vì mock mạng: staleTime vô hạn nên query dùng đúng dữ liệu này. */
function renderScreen(pendingItems: PendingSignature[], onSendMore = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  qc.setQueryData(pendingSignatureKeys.all, pendingItems);
  const view = render(
    <QueryClientProvider client={qc}>
      <SendGuardianWaitScreen intentId={INTENT} onCancelled={vi.fn()} onSendMore={onSendMore} />
    </QueryClientProvider>,
  );
  return { ...view, onSendMore };
}

describe("SendGuardianWaitScreen — sau khi ký tiếp", () => {
  it("🔴 ký THÀNH CÔNG → màn 'Đã gửi', KHÔNG quay về màn chờ, dù lệnh đã rời danh sách", () => {
    vi.mocked(mockedUseResumeSigning).mockReturnValue(
      signingState({ phase: "settled", txHash: HASH, activeIntentId: INTENT }),
    );
    // Danh sách RỖNG — đúng trạng thái ngay sau khi ký (BE thôi trả lệnh đã settle).
    renderScreen([]);

    expect(screen.getByText("Đã gửi")).toBeInTheDocument();
    // Đây là dòng đã sai trong test tay: màn chờ tuyệt đối không được hiện lại.
    expect(screen.queryByText("Đang chờ người thân")).not.toBeInTheDocument();
    expect(screen.queryByText("Huỷ lệnh này")).not.toBeInTheDocument();
  });

  it("🔴 ĐÚNG TRÌNH TỰ THẬT: đang hiện lệnh → ký xong → danh sách rỗng → màn 'Đã gửi'", () => {
    // Trình tự của lỗi test tay, từng bước một. Ca trên dựng sẵn danh sách rỗng
    // nên không phân biệt được thứ tự nhánh; ca này CÓ đi qua lượt render "đang
    // hiện lệnh" trước, nên nếu nhánh `item` được xét trước nhánh `settled` thì
    // màn sẽ mắc lại ở khối "Người thân đã đồng ý" thay vì màn kết cục.
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    const onSendMore = vi.fn();
    // Element MỚI mỗi lượt: rerender với cùng một object có thể bị React bỏ qua.
    const tree = () => (
      <QueryClientProvider client={qc}>
        <SendGuardianWaitScreen intentId={INTENT} onCancelled={vi.fn()} onSendMore={onSendMore} />
      </QueryClientProvider>
    );

    // Bước 1 — người thân vừa duyệt: lệnh có trong danh sách, nút ký hiện ra.
    qc.setQueryData(pendingSignatureKeys.all, [item]);
    const view = render(tree());
    expect(screen.getByTestId("pending-signature-sign")).toBeInTheDocument();

    // Bước 2 — ký xong: máy báo settled VÀ lệnh rời danh sách (cú invalidate của
    // use-resume-signing). Hai chuyện này xảy ra cùng lúc trong đời thật.
    vi.mocked(mockedUseResumeSigning).mockReturnValue(
      signingState({ phase: "settled", txHash: HASH, activeIntentId: INTENT }),
    );
    // act(): setQueryData bắn thông báo cho observer của useQuery — không bọc thì
    // cập nhật đó chưa flush và màn vẫn render dữ liệu CŨ (test đỏ giả).
    act(() => {
      qc.setQueryData(pendingSignatureKeys.all, []);
    });
    view.rerender(tree());

    expect(screen.getByText("Đã gửi")).toBeInTheDocument();
    expect(screen.getByTestId("send-done-again")).toBeInTheDocument();
    expect(screen.queryByText("Đang chờ người thân")).not.toBeInTheDocument();
    // Không mắc lại ở khối chờ-ký: nút "Xác nhận và gửi" phải biến mất.
    expect(screen.queryByTestId("pending-signature-sign")).not.toBeInTheDocument();
  });

  it("màn 'Đã gửi' có mã giao dịch link StellarExpert đúng hash", () => {
    vi.mocked(mockedUseResumeSigning).mockReturnValue(
      signingState({ phase: "settled", txHash: HASH, activeIntentId: INTENT }),
    );
    renderScreen([]);

    const explorer = screen
      .getAllByRole("link")
      .find((a) => a.getAttribute("href")?.includes("stellar.expert"));
    expect(explorer).toBeDefined();
    expect(explorer).toHaveAttribute("href", expect.stringContaining(`/tx/${HASH}`));
  });

  it("màn 'Đã gửi' có đường ra: về hub ví + gửi tiếp", async () => {
    vi.mocked(mockedUseResumeSigning).mockReturnValue(
      signingState({ phase: "settled", txHash: HASH, activeIntentId: INTENT }),
    );
    const { onSendMore } = renderScreen([]);

    expect(screen.getByText("Về ví của tôi").closest("a")).toHaveAttribute("data-to", "/wallet");
    const again = screen.getByTestId("send-done-again");
    again.click();
    expect(onSendMore).toHaveBeenCalledTimes(1);
  });

  it("ký LỖI + lệnh đã rời danh sách → vẫn nói ra lỗi, KHÔNG âm thầm về màn chờ", () => {
    vi.mocked(mockedUseResumeSigning).mockReturnValue(
      signingState({ phase: "failed", error: new Error("BOOM"), activeIntentId: INTENT }),
    );
    // Render lần đầu CÓ lệnh (như lúc vừa được duyệt), rồi danh sách rỗng đi.
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    qc.setQueryData(pendingSignatureKeys.all, [item]);
    const view = render(
      <QueryClientProvider client={qc}>
        <SendGuardianWaitScreen intentId={INTENT} onCancelled={vi.fn()} onSendMore={vi.fn()} />
      </QueryClientProvider>,
    );
    act(() => {
      qc.setQueryData(pendingSignatureKeys.all, []);
    });
    view.rerender(
      <QueryClientProvider client={qc}>
        <SendGuardianWaitScreen intentId={INTENT} onCancelled={vi.fn()} onSendMore={vi.fn()} />
      </QueryClientProvider>,
    );
    // Nút ký VẪN CÒN có chủ ý: lỗi trước điểm nộp thì thử lại được.
    expect(screen.getByTestId("pending-signature-sign")).toBeInTheDocument();
    // Câu lỗi phải HIỆN RA — im lặng là đúng cái bẫy đang vá.
    expect(screen.getByText("Chưa có gì được gửi đi. Bạn có thể thử lại an toàn.")).toBeVisible();

    // "Người thân đã đồng ý" có ở HAI chỗ (tiêu đề + nhãn dòng) → đối chiếu câu
    // mô tả riêng của khối đã-duyệt.
    expect(screen.getByText(/Chỉ còn bước cuối/)).toBeInTheDocument();
    expect(screen.queryByText("Đang chờ người thân")).not.toBeInTheDocument();
  });
});

describe("SendGuardianWaitScreen — các nhánh cũ KHÔNG đổi", () => {
  it("đã duyệt, chưa ký → khối 'Người thân đã đồng ý' + nút xác nhận", () => {
    renderScreen([item]);
    expect(screen.getByText(/Chỉ còn bước cuối/)).toBeInTheDocument();
    expect(screen.getByTestId("pending-signature-sign")).toBeInTheDocument();
    // Địa chỉ ĐẦY ĐỦ phải còn nguyên: nó là thứ máy ký đem đối chiếu entry.
    expect(screen.getByText(item.recipient as string)).toBeInTheDocument();
  });

  it("chưa duyệt, chưa ký gì → màn chờ + nút huỷ (không hồi quy)", () => {
    renderScreen([]);
    expect(screen.getByText("Đang chờ người thân")).toBeInTheDocument();
    expect(screen.getByText("Huỷ lệnh này")).toBeInTheDocument();
    expect(screen.queryByText("Đã gửi")).not.toBeInTheDocument();
  });
});
