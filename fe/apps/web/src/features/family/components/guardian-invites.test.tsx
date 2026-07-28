// Bug 28/07 — hai điều UI phải giữ được:
// 1. Trang accept đổi hình dạng theo phiên: khối giới thiệu THU GỌN được
//    (vẫn xem lại được, không biến mất).
// 2. Danh sách mời nói câu lỗi ĐÚNG NGUYÊN NHÂN, và dòng trùng danh tính
//    không còn nút "Thêm vào ví" (bấm được rồi mới báo lỗi là bẫy).
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";
import type { GuardianInvite } from "../api/invites";
import { GuardianAcceptIntro } from "./guardian-accept-intro";
import { InviteStatusList } from "./invite-status-list";

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
});

const ADDR_A = `C${"A".repeat(55)}`;
const ADDR_B = `C${"B".repeat(55)}`;

const invite = (over: Partial<GuardianInvite>): GuardianInvite => ({
  id: "01TEST000000000000000000IN",
  label: "Mẹ",
  status: "sent",
  guardian_address: null,
  expires_at: "2026-08-04T00:00:00Z",
  ...over,
});

describe("GuardianAcceptIntro", () => {
  it("dạng đầy đủ: hai thẻ giúp/không-làm-được hiện thẳng, không details", () => {
    const { container } = render(<GuardianAcceptIntro collapsed={false} />);
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getByText("Bạn giúp được gì")).toBeInTheDocument();
  });

  it("dạng thu gọn: bọc trong <details> với dòng 'Xem lại' — nội dung KHÔNG mất", () => {
    const { container } = render(<GuardianAcceptIntro collapsed={true} />);
    expect(container.querySelector("details")).not.toBeNull();
    expect(screen.getByText("Xem lại bạn giúp được gì")).toBeInTheDocument();
    // Nội dung vẫn nằm trong DOM (mở ra là thấy) — thu gọn ≠ xoá.
    expect(screen.getByText("Bạn giúp được gì")).toBeInTheDocument();
  });
});

describe("InviteStatusList", () => {
  it("câu lỗi theo ĐÚNG mã — trùng danh tính không còn là 'chưa có gì thay đổi'", () => {
    render(
      <InviteStatusList
        invites={[invite({ id: "01TEST000000000000000000I1", status: "deployed", guardian_address: ADDR_A })]}
        onAdd={vi.fn()}
        pending={false}
        errorKey="guardians.inviteList.addFailedAlready"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Người này đã là người bảo hộ của bạn rồi.",
    );
  });

  it("dòng deployed mang địa chỉ ĐÃ registered → ẩn nút, hiện nhãn giải thích", () => {
    render(
      <InviteStatusList
        invites={[
          invite({ id: "01TEST000000000000000000I2", label: "Chị", status: "registered", guardian_address: ADDR_A }),
          invite({ id: "01TEST000000000000000000I3", label: "Chị lần 2", status: "deployed", guardian_address: ADDR_A }),
          invite({ id: "01TEST000000000000000000I4", label: "Anh", status: "deployed", guardian_address: ADDR_B }),
        ]}
        onAdd={vi.fn()}
        pending={false}
        errorKey={null}
      />,
    );
    // Dòng trùng: nhãn thay nút.
    expect(screen.getByTestId("already-guardian-01TEST000000000000000000I3")).toHaveTextContent(
      "Đã là người bảo hộ",
    );
    expect(screen.queryByTestId("add-guardian-01TEST000000000000000000I3")).toBeNull();
    // Dòng danh tính mới: nút vẫn hiện.
    expect(screen.getByTestId("add-guardian-01TEST000000000000000000I4")).toBeInTheDocument();
  });
});
