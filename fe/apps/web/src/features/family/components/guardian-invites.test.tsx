// Bug 28/07 — hai điều UI phải giữ được:
// 1. Trang accept đổi hình dạng theo phiên: khối giới thiệu THU GỌN được
//    (vẫn xem lại được, không biến mất).
// 2. Danh sách mời nói câu lỗi ĐÚNG NGUYÊN NHÂN, và dòng trùng danh tính
//    không còn nút "Thêm vào ví" (bấm được rồi mới báo lỗi là bẫy).
import { fireEvent, render, screen } from "@testing-library/react";
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

const noBatch = { running: false, currentId: null, results: {} };

/** Gác 29/07 (bug {{name}} lần hai): chuỗi ĐÃ RENDER không được còn {{ }}. */
function expectNoRawBraces(container: HTMLElement) {
  expect(container.textContent ?? "").not.toMatch(/\{\{|\}\}/);
}

describe("InviteStatusList", () => {
  it("câu lỗi theo ĐÚNG mã — trùng danh tính không còn là 'chưa có gì thay đổi'", () => {
    const { container } = render(
      <InviteStatusList
        invites={[
          invite({
            id: "01TEST000000000000000000I1",
            status: "deployed",
            guardian_address: ADDR_A,
          }),
        ]}
        onAdd={vi.fn()}
        onAddAll={vi.fn()}
        pending={false}
        errorKey="guardians.inviteList.addFailedAlready"
        addAll={noBatch}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Người này đã là người bảo hộ của bạn rồi.",
    );
    expectNoRawBraces(container);
  });

  it("dòng deployed mang địa chỉ ĐÃ registered → ẩn nút, hiện nhãn giải thích", () => {
    const { container } = render(
      <InviteStatusList
        invites={[
          invite({
            id: "01TEST000000000000000000I2",
            label: "Chị",
            status: "registered",
            guardian_address: ADDR_A,
          }),
          invite({
            id: "01TEST000000000000000000I3",
            label: "Chị lần 2",
            status: "deployed",
            guardian_address: ADDR_A,
          }),
          invite({
            id: "01TEST000000000000000000I4",
            label: "Anh",
            status: "deployed",
            guardian_address: ADDR_B,
          }),
        ]}
        onAdd={vi.fn()}
        onAddAll={vi.fn()}
        pending={false}
        errorKey={null}
        addAll={noBatch}
      />,
    );
    // Dòng trùng: nhãn thay nút.
    expect(screen.getByTestId("already-guardian-01TEST000000000000000000I3")).toHaveTextContent(
      "Đã là người bảo hộ",
    );
    expect(screen.queryByTestId("add-guardian-01TEST000000000000000000I3")).toBeNull();
    // Dòng danh tính mới: nút vẫn hiện.
    expect(screen.getByTestId("add-guardian-01TEST000000000000000000I4")).toBeInTheDocument();
    // Trùng danh tính → chỉ MỘT người thêm được → không hiện "Thêm tất cả".
    expect(screen.queryByTestId("add-all-guardians")).toBeNull();
    expectNoRawBraces(container);
  });

  it("≥2 người deployed thêm được → hiện 'Thêm tất cả', bấm là nhận đúng danh sách", () => {
    const onAddAll = vi.fn();
    const { container } = render(
      <InviteStatusList
        invites={[
          invite({
            id: "01TEST000000000000000000I5",
            label: "Mẹ",
            status: "deployed",
            guardian_address: ADDR_A,
          }),
          invite({
            id: "01TEST000000000000000000I6",
            label: "Anh ba",
            status: "deployed",
            guardian_address: ADDR_B,
          }),
          invite({ id: "01TEST000000000000000000I7", label: "Chưa xong", status: "sent" }),
        ]}
        onAdd={vi.fn()}
        onAddAll={onAddAll}
        pending={false}
        errorKey={null}
        addAll={noBatch}
      />,
    );
    const btn = screen.getByTestId("add-all-guardians");
    expect(btn).toHaveTextContent("Thêm tất cả (2)");
    fireEvent.click(btn);
    expect(onAddAll).toHaveBeenCalledTimes(1);
    // Chỉ 2 người deployed — người `sent` không vào loạt.
    expect(onAddAll.mock.calls[0]?.[0]).toHaveLength(2);
    expectNoRawBraces(container);
  });

  it("đang chạy loạt: nút hiện tiến độ, dòng lỗi báo NGAY DÒNG ĐÓ", () => {
    const { container } = render(
      <InviteStatusList
        invites={[
          invite({
            id: "01TEST000000000000000000I8",
            label: "Mẹ",
            status: "deployed",
            guardian_address: ADDR_A,
          }),
          invite({
            id: "01TEST000000000000000000I9",
            label: "Anh ba",
            status: "deployed",
            guardian_address: ADDR_B,
          }),
        ]}
        onAdd={vi.fn()}
        onAddAll={vi.fn()}
        pending={false}
        errorKey={null}
        addAll={{
          running: true,
          currentId: "01TEST000000000000000000I9",
          results: { "01TEST000000000000000000I8": "guardians.inviteList.addFailed" },
        }}
      />,
    );
    expect(screen.getByTestId("add-all-guardians")).toHaveTextContent("Đang thêm 1/2…");
    expect(screen.getByTestId("add-all-error-01TEST000000000000000000I8")).toHaveTextContent(
      "Chưa thêm được.",
    );
    expect(screen.queryByTestId("add-all-error-01TEST000000000000000000I9")).toBeNull();
    expectNoRawBraces(container);
  });
});
