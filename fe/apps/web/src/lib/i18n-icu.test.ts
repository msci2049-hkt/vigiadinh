// Test dây ICU (PHA 7.1) — chứng minh initI18n THẬT render cú pháp ICU
// ({var}, plural) và key thiếu ra CHUỖI RỖNG (không lộ key thô — luật i18n N5).
import { initI18n } from "@repo/i18n";
import { beforeAll, describe, expect, it, vi } from "vitest";

const i18n = initI18n({
  defaultLocale: "en",
  supportedLngs: ["en", "vi"],
  eagerResources: {
    en: {
      common: {
        greet: "Hello {name}",
        users: "{count, plural, one {# user} other {# users}}",
      },
    },
    vi: { common: { greet: "Chào {name}" } },
  },
  loadNamespace: () => Promise.resolve({}),
  defaultNS: "common",
});

// Test dùng catalog RIÊNG (greet/users) ngoài catalog app — thoát type
// augmentation của types/i18next.d.ts bằng MỘT cast tại đây, không any.
const t = i18n.t.bind(i18n) as (key: string, opts?: Record<string, unknown>) => string;

beforeAll(async () => {
  await vi.waitFor(() => {
    if (!i18n.isInitialized) throw new Error("i18n chưa init xong");
  });
  await i18n.changeLanguage("en");
});

describe("ICU wiring qua initI18n", () => {
  it("interpolation ICU {name} (KHÔNG phải {{name}} i18next cũ)", () => {
    expect(t("greet", { name: "An" })).toBe("Hello An");
  });

  it("plural ICU: 1 user / 5 users", () => {
    expect(t("users", { count: 1 })).toBe("1 user");
    expect(t("users", { count: 5 })).toBe("5 users");
  });

  it("key thiếu ở vi → fallback en (không vỡ)", async () => {
    await i18n.changeLanguage("vi");
    expect(t("greet", { name: "An" })).toBe("Chào An");
    expect(t("users", { count: 5 })).toBe("5 users"); // vi thiếu → en
    await i18n.changeLanguage("en");
  });

  it("key thiếu ở MỌI ngôn ngữ → chuỗi RỖNG, cấm lộ key thô", () => {
    expect(t("khong.ton.tai.dau")).toBe("");
  });
});
