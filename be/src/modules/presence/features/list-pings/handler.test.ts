import { describe, expect, it } from "bun:test";
import { deviceKindEnum } from "../../domain/validators";
import { listPingsQuery } from "./dto";

describe("presence validators", () => {
  it("kind enum khớp CHECK constraint", () => {
    expect(deviceKindEnum.options).toEqual(["owner", "guardian"]);
  });
  it("limit coerce từ string query", () => {
    expect(listPingsQuery.parse({ limit: "10" })).toEqual({ limit: 10 });
  });
});
