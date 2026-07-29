// Lỗi phải có LỐI THOÁT. Test này khoá vế thứ ba của luật lô 29/07: mỗi câu lỗi
// nói được "giờ làm gì", và cái nút đó trỏ đúng chỗ.
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import type { SendErrorView } from "../lib/send-error";
import { SendErrorBanner } from "./send-error-banner";

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

const view = (over: Partial<SendErrorView>): SendErrorView => ({
  title: "wallet.send.errors.notSent",
  action: null,
  ...over,
});

describe("SendErrorBanner", () => {
  it("ví chưa được bảo vệ → câu riêng + nút dẫn tới luồng mời", () => {
    render(
      <SendErrorBanner
        view={view({
          title: "wallet.send.errors.notProtectedTitle",
          body: "wallet.send.errors.notProtectedBody",
          action: "protect",
        })}
        protectTo="/setup/choose-guardians"
      />,
    );
    expect(screen.getByText("Ví đang khoá để bảo vệ tài sản của bạn")).toBeInTheDocument();
    // Câu trấn an "tiền chưa rời ví" là điểm tốt sẵn có — không được mất.
    expect(screen.getByTestId("send-error")).toHaveTextContent("không có gì được gửi đi");
    expect(screen.getByTestId("send-error-protect")).toHaveAttribute(
      "data-to",
      "/setup/choose-guardians",
    );
  });

  it("vượt hạn mức → nút dẫn tới Cài đặt An toàn", () => {
    render(
      <SendErrorBanner
        view={view({ title: "wallet.send.errors.spendingLimit", action: "safety" })}
        protectTo="/setup/choose-guardians"
      />,
    );
    expect(screen.getByTestId("send-error-safety")).toHaveAttribute("data-to", "/settings");
  });

  it("lệnh đã cũ → nút làm lại từ đầu gọi đúng callback", () => {
    const onStartOver = vi.fn();
    render(
      <SendErrorBanner
        view={view({ title: "wallet.send.errors.staleIntentTitle", action: "startOver" })}
        protectTo="/setup/choose-guardians"
        onStartOver={onStartOver}
      />,
    );
    screen.getByTestId("send-error-startover").click();
    expect(onStartOver).toHaveBeenCalledOnce();
  });

  it("mã chưa map → câu chung + DÒNG MÃ KỸ THUẬT (để chẩn đoán từ ảnh chụp màn hình)", () => {
    render(
      <SendErrorBanner view={view({ code: "SOME_NEW_CODE" })} protectTo="/setup/choose-guardians" />,
    );
    expect(screen.getByTestId("send-error-code")).toHaveTextContent("SOME_NEW_CODE");
  });

  it("mã ĐÃ map → KHÔNG hiện mã kỹ thuật (người thường không cần đọc)", () => {
    render(
      <SendErrorBanner
        view={view({ title: "wallet.send.errors.notProtectedTitle", action: "protect" })}
        protectTo="/setup/review"
      />,
    );
    expect(screen.queryByTestId("send-error-code")).toBeNull();
  });
});
