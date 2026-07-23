// Test logic pending-detection của migrate gate (thuần, không cần DB).
// (3 case tương ứng đã được chạy thật trên Postgres ephemeral khi audit prod.)
import { describe, expect, test } from "bun:test";
import { computePending, type JournalEntry, parseJournal } from "./migrate";

const J = (idx: number, when: number, tag: string): JournalEntry => ({ idx, when, tag });

describe("parseJournal", () => {
  test("parse + sort theo idx", () => {
    const out = parseJournal({
      entries: [
        { idx: 1, version: "7", when: 200, tag: "0001_b", breakpoints: true },
        { idx: 0, version: "7", when: 100, tag: "0000_a", breakpoints: true },
      ],
    });
    expect(out.map((e) => e.tag)).toEqual(["0000_a", "0001_b"]);
  });

  test("journal hỏng (không entries / entry thiếu field) → throw rõ", () => {
    expect(() => parseJournal({})).toThrow("entries");
    expect(() => parseJournal({ entries: [{ idx: 0 }] })).toThrow("entry hỏng");
  });
});

describe("computePending (logic của drizzle migrator: when > created_at cuối)", () => {
  const entries = [J(0, 100, "0000_a"), J(1, 200, "0001_b"), J(2, 300, "0002_c")];

  test("DB chưa từng migrate (null) → pending toàn bộ", () => {
    expect(computePending(entries, null)).toHaveLength(3);
  });

  test("đã apply hết → pending rỗng (case a: exit 0)", () => {
    expect(computePending(entries, 300)).toEqual([]);
  });

  test("apply tới giữa → pending phần sau (case b: liệt kê + chạy)", () => {
    expect(computePending(entries, 200).map((e) => e.tag)).toEqual(["0002_c"]);
  });

  test("journal rỗng → không pending", () => {
    expect(computePending([], null)).toEqual([]);
  });
});
