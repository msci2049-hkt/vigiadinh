// GÁC A2 (2026-07-30): màn lịch sử VỨT NGUYÊN payload đã có trong response —
// người dùng gửi 65 XLM xong mở lịch sử ra chỉ thấy một câu chung, không mã giao
// dịch, không trạng thái, không có gì đối chiếu được với mạng lưới.
//
// GÁC B3: số tiền + người nhận (BE join từ transaction_intents) phải hiện ra, và
// CHỈ dòng tiền đã ra khỏi ví được nói "Đã gửi X cho Y".
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import type { AuditEntry } from "@/features/family/api/audit";
import i18n from "@/lib/i18n";
import { AuditEntryRow } from "./audit-entry-row";

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

const HASH = "bb4641e1".padEnd(64, "0");
// Người nhận thật của giao dịch 65 XLM trong ví test 01KYRQ07WM…
const RECIPIENT = "CBYKUIYA7LNNVQJCMKVG664R75V23YX5V4GHGIP5VTDVFDU6GW35SYDI";

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "01KYRQ07WMTARAZFP7SFWJ8SP5",
  walletId: "01KYRQ07WMTARAZFP7SFWJ8SP5",
  kind: "intent.settled",
  payload: null,
  actorType: "owner",
  actorId: "u-1",
  deviceId: null,
  at: "2026-07-30T07:21:49.000Z",
  amount: null,
  recipient: null,
  ...over,
});

describe("AuditEntryRow", () => {
  it("payload đủ → trạng thái + mã giao dịch có link StellarExpert", () => {
    render(
      <AuditEntryRow
        entry={entry({ payload: { intentId: "01K", hash: HASH, status: "SUCCESS" } })}
      />,
    );

    expect(screen.getByText("Đã gửi tiền đi")).toBeInTheDocument();
    expect(screen.getByText("Đã xong")).toBeInTheDocument();

    const link = screen.getByRole("link");
    // Testnet theo env của test — điều bị khoá là ĐÚNG mạng + ĐÚNG hash.
    expect(link).toHaveAttribute("href", expect.stringContaining(`/tx/${HASH}`));
    expect(link).toHaveAttribute("href", expect.stringContaining("stellar.expert"));
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("payload RỖNG → vẫn render câu chính + thời gian, KHÔNG vỡ, không link rác", () => {
    render(<AuditEntryRow entry={entry({ kind: "intent.expired", payload: null })} />);
    expect(screen.getByText("Một yêu cầu chờ đã hết hạn")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("dòng 14:21 của ví thật: register_wallet nói ĐÚNG việc, không phải câu chung", () => {
    render(
      <AuditEntryRow
        entry={entry({
          kind: "recovery.onchain.submitted",
          payload: { method: "register_wallet", hash: HASH, status: "SUCCESS" },
        })}
      />,
    );
    expect(screen.getByText("Đã bật bảo vệ gia đình cho ví")).toBeInTheDocument();
    expect(screen.queryByText("Một thao tác đã được gửi lên mạng lưới")).not.toBeInTheDocument();
  });

  it("event on-chain (payload lồng data.txHash) → vẫn tìm ra mã giao dịch", () => {
    render(
      <AuditEntryRow
        entry={entry({
          kind: "register",
          payload: {
            eventId: "ev-1",
            ledger: 3875394,
            // Giá trị u64 timelock ĐÃ là string — bằng chứng vá BigInt phía BE
            // chảy tới đúng chỗ này mà FE đọc được bình thường.
            data: { topics: ["register"], value: [2, "86400"], txHash: HASH },
          },
        })}
      />,
    );
    expect(screen.getByText("Đã bật bảo vệ gia đình cho ví")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", expect.stringContaining(HASH));
  });
});

describe("AuditEntryRow — B3: số tiền + người nhận", () => {
  it("giao dịch 65 XLM: câu chính nói ĐỦ số tiền và người nhận", () => {
    render(
      <AuditEntryRow
        entry={entry({
          payload: { intentId: "01K", hash: HASH, status: "SUCCESS" },
          amount: "650000000", // stroops
          recipient: RECIPIENT,
        })}
      />,
    );
    // 650000000 stroops = 65 XLM. Địa chỉ rút gọn theo shortAddress của app (6+6).
    expect(screen.getByText("Đã gửi 65 XLM cho CBYKUI…35SYDI")).toBeInTheDocument();
    // Câu chung cũ KHÔNG còn — nó đã bị câu đầy đủ thay thế.
    expect(screen.queryByText("Đã gửi tiền đi")).not.toBeInTheDocument();
    expect(screen.getByText("Đã xong")).toBeInTheDocument();
  });

  it("🔴 dòng CHƯA gửi (đang chờ người thân) KHÔNG được nói 'Đã gửi'", () => {
    render(
      <AuditEntryRow
        entry={entry({
          kind: "intent.awaiting_guardian",
          payload: { intentId: "01K" },
          amount: "650000000",
          recipient: RECIPIENT,
        })}
      />,
    );
    // Câu theo trạng thái giữ nguyên...
    expect(screen.getByText("Lệnh gửi tiền đang chờ người thân xác nhận")).toBeInTheDocument();
    // ...số tiền xuống dòng phụ, và tuyệt đối không có chữ "Đã gửi".
    expect(screen.getByText("65 XLM cho CBYKUI…35SYDI")).toBeInTheDocument();
    expect(screen.queryByText(/Đã gửi/)).not.toBeInTheDocument();
  });

  it("amount null → KHÔNG hiện 'null', không hiện chỗ trống", () => {
    const { container } = render(
      <AuditEntryRow
        entry={entry({ payload: { hash: HASH, status: "SUCCESS" }, amount: null, recipient: null })}
      />,
    );
    expect(container.textContent).not.toContain("null");
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("undefined");
    expect(screen.getByText("Đã gửi tiền đi")).toBeInTheDocument();
  });

  it("có tiền nhưng KHÔNG có người nhận → hiện số tiền, không hiện 'cho'", () => {
    render(
      <AuditEntryRow
        entry={entry({ kind: "intent.cancelled", payload: {}, amount: "10000000" })}
      />,
    );
    expect(screen.getByText("Lệnh gửi tiền đã được huỷ")).toBeInTheDocument();
    expect(screen.getByText("1 XLM")).toBeInTheDocument();
  });

  it("số tiền vượt 2^53 stroop không sai một chữ số", () => {
    render(
      <AuditEntryRow
        entry={entry({ payload: {}, amount: "9007199254740993", recipient: RECIPIENT })}
      />,
    );
    // 9007199254740993 stroop = 900719925.4740993 XLM.
    expect(screen.getByText(/900\.719\.925,4740993 XLM/)).toBeInTheDocument();
  });

  it("English + 中文: số tiền và địa chỉ hiện đúng, không key thô", async () => {
    for (const [lng, expected] of [
      ["en", "Sent 65 XLM to CBYKUI…35SYDI"],
      ["zh", "已向 CBYKUI…35SYDI 转出 65 XLM"],
    ] as const) {
      await i18n.changeLanguage(lng);
      const { unmount } = render(
        <AuditEntryRow
          entry={entry({ payload: { hash: HASH }, amount: "650000000", recipient: RECIPIENT })}
        />,
      );
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    }
    await i18n.changeLanguage("vi");
  });
});
