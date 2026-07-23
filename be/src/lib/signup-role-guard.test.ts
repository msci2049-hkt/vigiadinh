import { describe, expect, test } from "bun:test";
import { enforcePublicSignupRole } from "./signup-role-guard";

const SIGNUP = "/sign-up/email";
// role sau khi qua guard — ép về unknown để so giá trị runtime, không vướng type hẹp.
const roleAfter = (input: Record<string, unknown>, path: string | undefined): unknown =>
  enforcePublicSignupRole(input, path).role;

describe("enforcePublicSignupRole", () => {
  test("public sign-up: role=admin bị ép về user (chống privilege escalation)", () => {
    expect(roleAfter({ role: "admin" }, SIGNUP)).toBe("user");
  });

  test("public sign-up: role=staff / super_admin bị ép về user", () => {
    expect(roleAfter({ role: "staff" }, SIGNUP)).toBe("user");
    expect(roleAfter({ role: "super_admin" }, SIGNUP)).toBe("user");
  });

  test("public sign-up: role không hợp lệ (mảng/số/null) → user", () => {
    expect(roleAfter({ role: ["admin", "user"] }, SIGNUP)).toBe("user");
    expect(roleAfter({ role: 1 }, SIGNUP)).toBe("user");
    expect(roleAfter({ role: null }, SIGNUP)).toBe("user");
  });

  test("public sign-up: role=user (whitelist) giữ nguyên", () => {
    expect(roleAfter({ role: "user" }, SIGNUP)).toBe("user");
  });

  test("public sign-up: không có role → ép về user", () => {
    expect(roleAfter({ email: "x@y.z" }, SIGNUP)).toBe("user");
  });

  test("admin.createUser: role=admin GIỮ NGUYÊN (KHÔNG phá admin API)", () => {
    expect(roleAfter({ role: "admin" }, "/admin/create-user")).toBe("admin");
  });

  test("path undefined (tạo nội bộ/seed) → giữ nguyên role", () => {
    expect(roleAfter({ role: "admin" }, undefined)).toBe("admin");
  });

  test("không mutate object gốc (trả bản sao)", () => {
    const input = { role: "admin", email: "a@b.c" };
    const out = enforcePublicSignupRole(input, SIGNUP);
    expect(input.role).toBe("admin"); // gốc không đổi
    expect(out.role).toBe("user"); // bản trả về bị ép
  });
});
