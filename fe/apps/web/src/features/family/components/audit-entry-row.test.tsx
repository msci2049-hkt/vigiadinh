// GÁC A2 (2026-07-30): màn lịch sử VỨT NGUYÊN payload đã có trong response —
// người dùng gửi 65 XLM xong mở lịch sử ra chỉ thấy một câu chung, không mã giao
// dịch, không trạng thái, không có gì đối chiếu được với mạng lưới.
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

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: "01KYRQ07WMTARAZFP7SFWJ8SP5",
  walletId: "01KYRQ07WMTARAZFP7SFWJ8SP5",
  kind: "intent.settled",
  payload: null,
  actorType: "owner",
  actorId: "u-1",
  deviceId: null,
  at: "2026-07-30T07:21:49.000Z",
  ...over,
});

describe("AuditEntryRow", () => {
  it("payload đủ → số tiền + trạng thái + mã giao dịch có link StellarExpert", () => {
    render(
      <AuditEntryRow
        entry={entry({
          payload: { intentId: "01K", hash: HASH, status: "SUCCESS", amount: "650000000" },
        })}
      />,
    );

    expect(screen.getByText("Đã gửi tiền đi")).toBeInTheDocument();
    expect(screen.getByText(/65 XLM/)).toBeInTheDocument(); // 650000000 stroop = 65 XLM
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
