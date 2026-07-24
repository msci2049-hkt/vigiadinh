import { describe, expect, it } from "vitest";
import { recoveryRegistryEntryScVal } from "./recovery-link";

describe("recovery-link", () => {
  // Vector ghim CHÉO Rust↔TS. Cặp song sinh:
  // contracts/smart-account/src/test.rs::recovery_entry_xdr_vector_matches_ts.
  // Nếu công thức mã hoá lệch một bên, ví deploy ra sẽ mất registry mà deploy
  // vẫn "thành công" — nên phải khoá bằng byte, không bằng niềm tin.
  it("mã hoá đúng vector XDR mà contract đọc được", () => {
    const scv = recoveryRegistryEntryScVal(86400);
    expect(scv.toXDR("base64")).toBe(
      "AAAAEAAAAAEAAAACAAAADwAAABBSZWNvdmVyeVJlZ2lzdHJ5AAAABQAAAAAAAVGA",
    );
  });

  it("cooldown khác cho ra XDR khác (payload thật sự đi vào)", () => {
    expect(recoveryRegistryEntryScVal(3600).toXDR("base64")).not.toBe(
      recoveryRegistryEntryScVal(86400).toXDR("base64"),
    );
  });
});
