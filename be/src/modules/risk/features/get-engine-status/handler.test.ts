import { describe, expect, it } from "bun:test";
import { engineStatusOutput } from "./dto";

describe("risk engine status contract", () => {
  it("engine là rules thuần, aiEnabled boolean", () => {
    expect(engineStatusOutput.parse({ engine: "rules", aiEnabled: false })).toEqual({
      engine: "rules",
      aiEnabled: false,
    });
  });
});
