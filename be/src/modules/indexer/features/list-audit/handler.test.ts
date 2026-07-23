import { describe, expect, it } from "bun:test";
import { listAuditQuery } from "./dto";

describe("indexer dto", () => {
  it("limit mặc định 50, coerce từ query string", () => {
    expect(listAuditQuery.parse({})).toEqual({ limit: 50 });
    expect(listAuditQuery.parse({ limit: "25" })).toEqual({ limit: 25 });
  });
});
