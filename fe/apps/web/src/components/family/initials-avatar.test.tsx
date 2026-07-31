// Lô R7 (D1) — ảnh đại diện là CHỮ CÁI ĐẦU, không phải ảnh người lạ.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InitialsAvatar, initialOf } from "./initials-avatar";

describe("initialOf", () => {
  it("chữ cái đầu, in hoa", () => {
    expect(initialOf("Nguyễn Hoàng Anh")).toBe("N");
    expect(initialOf("bà ngoại")).toBe("B");
  });

  it("🔴 tên có dấu tiếng Việt không bị cắt mất dấu", () => {
    // `"Ước"[0]` ở dạng NFD trả về "U" trần (dấu là ký tự riêng phía sau) hoặc
    // tệ hơn là nửa ký tự. Grapheme cluster giữ nguyên chữ có dấu.
    expect(initialOf("Ước")).toBe("Ư");
    expect(initialOf("Ước".normalize("NFD"))).toBe("Ư".normalize("NFD"));
    expect(initialOf("Đào")).toBe("Đ");
    expect(initialOf("ổn")).toBe("Ổ");
  });

  it("tên tiếng Trung / emoji không vỡ thành ô vuông", () => {
    expect(initialOf("小明")).toBe("小");
    expect(initialOf("👵 bà")).toBe("👵");
  });

  it("không có tên → dấu hỏi, KHÔNG bịa chữ từ địa chỉ ví", () => {
    expect(initialOf(null)).toBe("?");
    expect(initialOf(undefined)).toBe("?");
    expect(initialOf("   ")).toBe("?");
  });
});

describe("InitialsAvatar", () => {
  it("🔴 không render <img> nào — không có ảnh người thật trên màn này", () => {
    const { container } = render(<InitialsAvatar name="Nguyễn Hoàng Anh" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("initials-avatar").textContent).toBe("N");
  });
});
