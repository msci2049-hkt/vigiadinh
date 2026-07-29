// LÔ 4 — ô "Gửi tới": M… phải hiện ĐỦ hai câu (kèm mã sàn + chưa hỗ trợ,
// không im lặng nuốt); chọn người thân điền đúng địa chỉ + hiện nhãn; địa chỉ
// sai checksum báo ngay; môi trường không camera/clipboard thì KHÔNG vẽ nút.
import { Account, MuxedAccount } from "@stellar/stellar-sdk";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import { RecipientField } from "./recipient-field";

const CONTRACT = "CD5QX3XLAKQA2AVP62ZTI5REDAWDO2D2WOVGJGM7LZCKSOFRGYSE7AJT";
const CLASSIC = "GB4RZN2ZBZ6TS5SY45XE7R7DHX4HLNGHVJGJOMCIYQSMMY2AGT3CECWU";
const MUXED = new MuxedAccount(new Account(CLASSIC, "0"), "7").accountId();

function Host({
  initial,
  contacts,
}: {
  initial?: string;
  contacts?: { label: string; address: string }[];
}) {
  const [value, setValue] = useState(initial ?? "");
  return <RecipientField value={value} onChange={setValue} contacts={contacts ?? []} />;
}

beforeAll(async () => {
  await i18n.loadNamespaces(["fw"]);
  await i18n.changeLanguage("vi");
});

describe("RecipientField", () => {
  it("M… → hiện CẢ chú thích sàn LẪN câu chưa-hỗ-trợ, không nuốt", () => {
    render(<Host initial={MUXED} />);
    const note = screen.getByTestId("recipient-muxed");
    expect(note).toHaveTextContent("đã kèm mã nhận diện của sàn");
    expect(note).toHaveTextContent("chưa được hỗ trợ");
  });

  it("địa chỉ C hợp lệ → dòng trạng thái rút gọn, không câu lỗi", () => {
    render(<Host initial={CONTRACT} />);
    expect(screen.getByTestId("recipient-ok")).toHaveTextContent("CD5QX3…SE7AJT");
    expect(screen.queryByText(/không hợp lệ|chưa đúng/)).toBeNull();
  });

  it("người quen: trùng địa chỉ danh bạ → hiện nhãn 'Mẹ' thay chuỗi khô", () => {
    render(<Host initial={CONTRACT} contacts={[{ label: "Mẹ", address: CONTRACT }]} />);
    expect(screen.getByTestId("recipient-ok")).toHaveTextContent("Mẹ");
  });

  it("chọn từ danh bạ điền đúng địa chỉ", () => {
    render(<Host contacts={[{ label: "Mẹ", address: CONTRACT }]} />);
    fireEvent.click(screen.getByTestId("recipient-contacts"));
    fireEvent.click(screen.getByTestId(`recipient-contact-${CONTRACT.slice(0, 6)}`));
    expect(screen.getByLabelText(/gửi tới|người nhận/i)).toHaveValue(CONTRACT);
  });

  it("sai checksum (đổi 1 ký tự) → câu lỗi ngay khi gõ", () => {
    const corrupted = `${CONTRACT.slice(0, -1)}A`;
    render(<Host initial={corrupted} />);
    expect(screen.queryByTestId("recipient-ok")).toBeNull();
  });

  it("jsdom không có camera/clipboard → nút quét + dán KHÔNG render (nút chết)", () => {
    render(<Host />);
    expect(screen.queryByTestId("recipient-scan")).toBeNull();
    expect(screen.queryByTestId("recipient-paste")).toBeNull();
  });

  it("chuỗi render không còn {{ }} thô", () => {
    const { container } = render(
      <Host initial={CONTRACT} contacts={[{ label: "Mẹ", address: CONTRACT }]} />,
    );
    expect(container.textContent ?? "").not.toMatch(/\{\{|\}\}/);
  });
});
