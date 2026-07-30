// KHOÁ BẤT BIẾN user.id ≤ 64 byte cho CẢ BA đường tạo passkey (sự cố 30/07).
//
// Lớp bug "hợp lệ với TS nhưng trình duyệt/chain chối" đã gặp lần thứ TƯ —
// test này là hàng rào duy nhất chặn lần thứ năm. Mọi phép đo dùng TextEncoder
// (BYTE UTF-8), tuyệt đối không .length.
import { describe, expect, it } from "vitest";
import {
  passkeyOwnerName,
  recoveryPasskeyName,
  truncateToBytes,
  USER_ID_SUFFIX_MAX_BYTES,
  USER_NAME_MAX_BYTES,
  utf8Bytes,
  WEBAUTHN_USER_ID_MAX_BYTES,
} from "./passkey-label";

/** Đúng công thức kit (webauthn-ops.js:18), lấy đuôi DÀI NHẤT có thể. */
function worstCaseUserIdBytes(userName: string): number {
  return utf8Bytes(`${userName}:${"9".repeat(13)}:0.${"9".repeat(17)}`);
}

const APP = "FamilyHaven";
const REAL_EMAIL = "badbyboy.tn.zzz@gmail.com"; // 25 byte — email đã fail thật 30/07
const LONG_EMAIL = "nguoi.dung.rat.dai.2026@example-mail.com"; // 40 byte
const ADDRESS = "CCMTI7Q3XX2YAAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJM4A4";

describe("bất biến ≤64 byte cho user.id", () => {
  it("đuôi kit tối đa đúng bằng hằng số khai báo", () => {
    expect(utf8Bytes(`:${"9".repeat(13)}:0.${"9".repeat(17)}`)).toBe(USER_ID_SUFFIX_MAX_BYTES);
  });

  it("đường 1 — tạo ví (email thật đã fail 30/07)", () => {
    const name = passkeyOwnerName(APP, REAL_EMAIL);
    expect(utf8Bytes(name)).toBeLessThanOrEqual(USER_NAME_MAX_BYTES);
    expect(worstCaseUserIdBytes(name)).toBeLessThanOrEqual(WEBAUTHN_USER_ID_MAX_BYTES);
  });

  it("đường 1 — email 40 byte vẫn không tràn", () => {
    expect(utf8Bytes(LONG_EMAIL)).toBe(40);
    const name = passkeyOwnerName(APP, LONG_EMAIL);
    expect(worstCaseUserIdBytes(name)).toBeLessThanOrEqual(WEBAUTHN_USER_ID_MAX_BYTES);
  });

  it("đường 2 — guardian tạo danh tính mới (cùng builder, email là ownerLabel)", () => {
    // guardian-identity.ts → createWalletMinimal({ownerLabel: email}) → passkeyOwnerName.
    for (const email of [REAL_EMAIL, LONG_EMAIL, "a@b.c"]) {
      expect(worstCaseUserIdBytes(passkeyOwnerName(APP, email))).toBeLessThanOrEqual(
        WEBAUTHN_USER_ID_MAX_BYTES,
      );
    }
  });

  it("đường 3 — gõ cửa máy mới (bản cũ 32 byte name → 66 byte id, ĐÃ VỠ)", () => {
    const oldLabel = `${APP} recovery ${ADDRESS.slice(0, 4)}…${ADDRESS.slice(-4)}`;
    expect(worstCaseUserIdBytes(oldLabel)).toBeGreaterThan(WEBAUTHN_USER_ID_MAX_BYTES); // chứng minh bản cũ vỡ
    const name = recoveryPasskeyName(APP, ADDRESS);
    expect(utf8Bytes(name)).toBeLessThanOrEqual(USER_NAME_MAX_BYTES);
    expect(worstCaseUserIdBytes(name)).toBeLessThanOrEqual(WEBAUTHN_USER_ID_MAX_BYTES);
  });

  it("không có nhãn → fallback như trước a189e29, vẫn dưới trần", () => {
    const name = passkeyOwnerName(APP, undefined);
    expect(name).toBe("FamilyHaven owner");
    expect(worstCaseUserIdBytes(name)).toBeLessThanOrEqual(WEBAUTHN_USER_ID_MAX_BYTES);
  });
});

describe("tên vẫn phân biệt được ai là ai", () => {
  it("email lọt trần giữ NGUYÊN VẸN", () => {
    expect(passkeyOwnerName(APP, REAL_EMAIL)).toBe(REAL_EMAIL);
    expect(passkeyOwnerName(APP, "lipxjh@gmail.com")).toBe("lipxjh@gmail.com");
  });

  it("email quá dài giữ phần đầu + dấu …", () => {
    const name = passkeyOwnerName(APP, LONG_EMAIL);
    expect(name.startsWith("nguoi.dung.rat.dai")).toBe(true);
    expect(name.endsWith("…")).toBe(true);
  });

  it("tên máy-mới mang 4+4 ký tự địa chỉ ví", () => {
    expect(recoveryPasskeyName(APP, ADDRESS)).toContain("CCMT…M4A4");
  });
});

describe("truncateToBytes đếm BYTE, không đếm ký tự", () => {
  it("không cắt đôi ký tự nhiều byte", () => {
    // "aé" = 1 + 2 byte; trần 2 byte phải trả "a", không trả nửa ký tự é.
    expect(truncateToBytes("aé", 2)).toBe("a");
    expect(truncateToBytes("···", 4)).toBe("··"); // mỗi "·" 2 byte
  });
});
