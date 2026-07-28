// §3.2 — màn danh sách phải hiện LABEL thật chủ ví đặt ("Mẹ"), chuỗi cứng
// "Người thân trông ví" chỉ còn là fallback cho dữ liệu cũ không có label.
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/lib/i18n";
import { GuardianNameplate } from "./guardian-nameplate";

beforeAll(async () => {
  await i18n.changeLanguage("vi");
  await i18n.loadNamespaces(["fw"]);
});

const ADDR = `C${"A".repeat(55)}`;

describe("GuardianNameplate", () => {
  it("render label thật, KHÔNG phải chuỗi cứng", () => {
    render(<GuardianNameplate label="Mẹ" onchainKey={ADDR} />);
    expect(screen.getByText("Mẹ")).toBeInTheDocument();
    expect(screen.queryByText("Người thân trông ví")).toBeNull();
  });

  it("label null (dữ liệu cũ) → rơi về chuỗi i18n, không để trống", () => {
    render(<GuardianNameplate label={null} onchainKey={null} />);
    expect(screen.getByText("Người thân trông ví")).toBeInTheDocument();
  });
});
