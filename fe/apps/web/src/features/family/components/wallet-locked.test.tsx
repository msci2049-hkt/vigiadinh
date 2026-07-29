// Popup "ví đang khoá" — thứ đáng lẽ phải hiện ngày 29/07 thay vì để chủ ví đi
// hết form rồi chết bằng một câu chung.
//
// Ba tầng là YÊU CẦU, không phải gợi ý: vì sao chặn · đang bảo vệ cái gì · giờ
// làm gì. Test khoá cả ba, cộng con số thật (0/3) và ĐÍCH của nút chính — sai
// đích là người dùng bấm xong vẫn kẹt.
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import type { WalletLock } from "../lib/wallet-lock";
import { lockCtaTo, WalletLockedDialog, WalletLockedNotice } from "./wallet-locked";

// <Link> của TanStack cần RouterProvider; ở đây chỉ cần biết nó trỏ ĐI ĐÂU.
// PHẢI trải `rest`: <Button asChild> dùng Radix Slot, nó gộp prop (kể cả
// data-testid) XUỐNG child — nuốt rest là test không tìm thấy nút.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

const locked = (over: Partial<Extract<WalletLock, { locked: true }>> = {}) =>
  ({
    locked: true as const,
    step: "invite" as const,
    available: 0,
    required: 3,
    missing: 3,
    ...over,
  }) satisfies Extract<WalletLock, { locked: true }>;

describe("WalletLockedDialog", () => {
  it("mở ra là có đủ BA TẦNG + con số 0/3 + nút Mời người thân", () => {
    render(<WalletLockedDialog lock={locked()} open onOpenChange={() => {}} />);

    // Tầng 1 — vì sao chặn (nhắc đúng số người cần).
    expect(screen.getByText(/cần ít nhất 3 người thân/i)).toBeInTheDocument();
    // Tầng 2 — đang bảo vệ cái gì.
    expect(screen.getByText("Tiền của bạn vẫn an toàn.")).toBeInTheDocument();
    // Tầng 3 — đang ở đâu.
    expect(screen.getByTestId("wallet-locked-progress")).toHaveTextContent("0/3");
    // Lối đi tiếp.
    expect(screen.getByTestId("wallet-locked-cta")).toHaveTextContent("Mời người thân");
    expect(screen.getByText("Để sau")).toBeInTheDocument();
  });

  it("đóng thì KHÔNG render gì (không chặn người dùng đang làm việc khác)", () => {
    render(<WalletLockedDialog lock={locked()} open={false} onOpenChange={() => {}} />);
    expect(screen.queryByTestId("wallet-locked-dialog")).toBeNull();
  });

  it("ĐỦ người nhưng chưa đăng ký → đổi câu VÀ đổi nút sang bước cuối", () => {
    render(
      <WalletLockedDialog
        lock={locked({ step: "register", available: 3, missing: 0 })}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByTestId("wallet-locked-cta")).toHaveTextContent("Hoàn tất bảo vệ ví");
    expect(screen.getByTestId("wallet-locked-progress")).toHaveTextContent("3/3");
  });

  it("copy KHÔNG chứa thuật ngữ kỹ thuật (registry/contract/gas/on-chain…)", () => {
    const { container } = render(
      <WalletLockedDialog lock={locked()} open onOpenChange={() => {}} />,
    );
    const text = (container.ownerDocument.body.textContent ?? "").toLowerCase();
    for (const banned of ["registry", "sponsorship", "contract", "on-chain", "gas", "403"]) {
      expect(text, `lọt thuật ngữ "${banned}"`).not.toContain(banned);
    }
  });
});

describe("WalletLockedNotice (vào thẳng /wallet/send bằng link)", () => {
  it("hiện đủ ba tầng, và có đường quay về ví", () => {
    render(<WalletLockedNotice lock={locked()} />);
    expect(screen.getByTestId("wallet-locked-notice")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-locked-progress")).toHaveTextContent("0/3");
    expect(screen.getByText("Tiền của bạn vẫn an toàn.")).toBeInTheDocument();
    expect(screen.getByText("Về ví của tôi")).toBeInTheDocument();
  });
});

describe("lockCtaTo", () => {
  it("mỗi bước một ĐÍCH — nhầm là người dùng bấm xong vẫn kẹt", () => {
    expect(lockCtaTo("invite")).toBe("/setup/choose-guardians");
    expect(lockCtaTo("register")).toBe("/setup/review");
  });
});
