// GÁC TÁI DIỄN bug 29/07 (lần HAI): key viết cú pháp i18next cũ `{{name}}`
// trong khi dây i18n là ICU `{name}` → màn hình hiện nguyên "Ví của {{name}}".
// Bug này lọt qua build LẪN deploy hai lần vì không tầng nào RENDER chuỗi.
//
// Test này render THẬT từng chuỗi của TỪNG locale × TỪNG namespace qua đúng
// pipeline ICU của app (initI18n), truyền tham số tự suy từ chính message:
// - Chuỗi đã render còn `{{` hoặc `}}` → ĐỎ (đây là yêu cầu bắt buộc 29/07).
// - Còn `{name}` chưa thay (tham số không khớp/parse hỏng) → ĐỎ.
// - Render ra rỗng (ICU parse chết → i18next nuốt thành "") → ĐỎ.
import { describe, expect, it, vi } from "vitest";
import i18n from "@/lib/i18n";

// Nạp TĨNH đủ 15 catalog (3 locale × 5 namespace) — thiếu file là import đỏ
// ngay, không cần chờ runtime.
import admin_en from "@/locales/en/admin.json";
import auth_en from "@/locales/en/auth.json";
import common_en from "@/locales/en/common.json";
import errors_en from "@/locales/en/errors.json";
import fw_en from "@/locales/en/fw.json";
import admin_vi from "@/locales/vi/admin.json";
import auth_vi from "@/locales/vi/auth.json";
import common_vi from "@/locales/vi/common.json";
import errors_vi from "@/locales/vi/errors.json";
import fw_vi from "@/locales/vi/fw.json";
import admin_zh from "@/locales/zh/admin.json";
import auth_zh from "@/locales/zh/auth.json";
import common_zh from "@/locales/zh/common.json";
import errors_zh from "@/locales/zh/errors.json";
import fw_zh from "@/locales/zh/fw.json";

const CATALOGS: Record<string, Record<string, unknown>> = {
  en: { admin: admin_en, auth: auth_en, common: common_en, errors: errors_en, fw: fw_en },
  vi: { admin: admin_vi, auth: auth_vi, common: common_vi, errors: errors_vi, fw: fw_vi },
  zh: { admin: admin_zh, auth: auth_zh, common: common_zh, errors: errors_zh, fw: fw_zh },
};

/** Duyệt cây JSON → map "a.b.c" → chuỗi message gốc. */
function flatten(node: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof node === "string") {
    out.set(prefix, node);
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

/**
 * Suy tham số từ chính message ICU: `{name}` → chuỗi; `{n, plural…}` /
 * `{n, number}` → số; `{d, date}`/`{d, time}` → Date. Đủ cho catalog app —
 * message cần kiểu lạ hơn thì test đỏ và ta mở rộng có chủ đích.
 */
function paramsFor(message: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const re = /\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*([A-Za-z]+))?/g;
  for (const m of message.matchAll(re)) {
    const [, name, kind] = m;
    if (!name) continue;
    if (kind === "plural" || kind === "number" || kind === "selectordinal") {
      params[name] = 2;
    } else if (kind === "date" || kind === "time") {
      params[name] = new Date(0);
    } else if (kind === "select") {
      params[name] = "khac"; // rơi nhánh `other`
    } else {
      params[name] = "X";
    }
  }
  return params;
}

describe("catalog render thật qua ICU — không chuỗi nào được ra {{ }} hay {tham_so} thô", () => {
  it("mọi locale × namespace × key render sạch", async () => {
    await vi.waitFor(() => {
      if (!i18n.isInitialized) throw new Error("i18n chưa init xong");
    });
    const failures: string[] = [];
    for (const [lng, namespaces] of Object.entries(CATALOGS)) {
      await i18n.loadNamespaces(Object.keys(namespaces));
      await i18n.changeLanguage(lng);
      for (const [ns, catalog] of Object.entries(namespaces)) {
        const flat = new Map<string, string>();
        flatten(catalog, "", flat);
        const t = i18n.getFixedT(lng, ns);
        for (const [key, source] of flat) {
          const rendered = t(key, paramsFor(source)) as string;
          if (rendered.includes("{{") || rendered.includes("}}")) {
            failures.push(`${lng}/${ns}:${key} → còn {{ }}: "${rendered}"`);
          } else if (/\{\s*[A-Za-z_][A-Za-z0-9_]*\s*[},]/.test(rendered)) {
            failures.push(`${lng}/${ns}:${key} → placeholder chưa thay: "${rendered}"`);
          } else if (rendered === "" && source !== "") {
            failures.push(`${lng}/${ns}:${key} → render RỖNG (ICU parse chết?)`);
          }
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("3 locale cùng SHAPE key (không locale nào thiếu màn)", () => {
    const shapes = Object.entries(CATALOGS).map(([lng, namespaces]) => {
      const keys: string[] = [];
      for (const [ns, catalog] of Object.entries(namespaces)) {
        const flat = new Map<string, string>();
        flatten(catalog, "", flat);
        for (const k of flat.keys()) keys.push(`${ns}:${k}`);
      }
      return { lng, keys: keys.sort() };
    });
    const [first, ...rest] = shapes;
    if (!first) throw new Error("không có catalog nào");
    for (const other of rest) {
      expect(other.keys, `${other.lng} lệch shape với ${first.lng}`).toEqual(first.keys);
    }
  });
});
