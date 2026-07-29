import { describe, expect, it } from "vitest";
import { isAuthPath, sanitizeRedirect, unauthorizedNavigation } from "./redirect-param";

describe("sanitizeRedirect — chống open redirect, giữ đường nội bộ", () => {
  it("đường nội bộ có query (link mời guardian) đi qua NGUYÊN VẸN", () => {
    expect(sanitizeRedirect("/guardian/accept?token=abc123")).toBe("/guardian/accept?token=abc123");
  });

  it("URL tuyệt đối ra ngoài bị bỏ", () => {
    expect(sanitizeRedirect("https://evil.com/phish")).toBeUndefined();
  });

  it("protocol-relative //evil.com và /\\evil.com bị bỏ", () => {
    expect(sanitizeRedirect("//evil.com")).toBeUndefined();
    expect(sanitizeRedirect("/\\evil.com")).toBeUndefined();
  });

  it("thiếu / rỗng → undefined (rơi về postAuthPath)", () => {
    expect(sanitizeRedirect(undefined)).toBeUndefined();
    expect(sanitizeRedirect("")).toBeUndefined();
  });
});

// GÁC TÁI DIỄN sự cố 29/07: `/login?redirect=%2Flogin%3Fredirect%3D%252F` —
// redirect trỏ về CHÍNH trang auth, mỗi vòng mã hoá thêm một tầng. Đây là đường
// nội bộ hợp lệ nên cửa chống open-redirect ở trên cho qua; cửa dưới đây mới chặn.
describe("sanitizeRedirect — chặn redirect tự trỏ vào trang auth (vòng lặp)", () => {
  it("chính URL vòng lặp quan sát trên production → undefined", () => {
    expect(sanitizeRedirect("/login?redirect=/")).toBeUndefined();
    expect(sanitizeRedirect("/login?redirect=/login?redirect=/")).toBeUndefined();
  });

  it("mọi trang auth trần đều bị chặn", () => {
    expect(sanitizeRedirect("/login")).toBeUndefined();
    expect(sanitizeRedirect("/sign-up")).toBeUndefined();
    expect(sanitizeRedirect("/verify-email")).toBeUndefined();
    expect(sanitizeRedirect("/reset-password")).toBeUndefined();
  });

  it("chặn cả khi có hash, không chỉ query", () => {
    expect(sanitizeRedirect("/login#x")).toBeUndefined();
  });

  it("đường ứng dụng THẬT vẫn qua — không được chặn nhầm", () => {
    expect(sanitizeRedirect("/wallet")).toBe("/wallet");
    expect(sanitizeRedirect("/wallet/send")).toBe("/wallet/send");
    // Tiền tố trùng chữ nhưng KHÁC route không được dính oan.
    expect(sanitizeRedirect("/login-help")).toBe("/login-help");
  });
});

describe("isAuthPath", () => {
  it("khớp chính xác + route con, KHÔNG khớp tiền tố lem", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/reset-password")).toBe(true);
    expect(isAuthPath("/login/anything")).toBe(true);
    expect(isAuthPath("/login-help")).toBe(false);
    expect(isAuthPath("/wallet")).toBe(false);
  });
});

describe("unauthorizedNavigation — xử lý 401 của apiClient", () => {
  it("đang Ở trang login → KHÔNG điều hướng (đá tiếp là lồng vòng lặp)", () => {
    expect(unauthorizedNavigation({ pathname: "/login", search: "?redirect=%2F" })).toEqual({
      navigate: false,
    });
  });

  it("đang ở /wallet → điều hướng kèm redirect=/wallet", () => {
    expect(unauthorizedNavigation({ pathname: "/wallet", search: "" })).toEqual({
      navigate: true,
      redirect: "/wallet",
    });
  });

  it("giữ nguyên query của trang đang đứng", () => {
    expect(unauthorizedNavigation({ pathname: "/guardian/accept", search: "?token=abc" })).toEqual({
      navigate: true,
      redirect: "/guardian/accept?token=abc",
    });
  });
});
