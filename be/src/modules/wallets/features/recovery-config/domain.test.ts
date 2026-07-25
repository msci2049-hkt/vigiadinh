import { describe, expect, it } from "bun:test";
import { DEFAULT_THRESHOLD, DEFAULT_TIMELOCK_SECS, validateRecoveryConfig } from "./domain";

const base = { threshold: 2, timelockSecs: 86400, registeredOnchain: false };

describe("cấu hình khôi phục", () => {
  it("mặc định là 2 người / 24 giờ", () => {
    expect(DEFAULT_THRESHOLD).toBe(2);
    expect(DEFAULT_TIMELOCK_SECS).toBe(86400);
  });

  it("cấu hình hợp lệ đi qua", () => {
    expect(validateRecoveryConfig(base)).toBeNull();
  });

  it("ĐÓNG BĂNG sau khi đăng ký on-chain — registry v2 không có set_threshold, ghi DB số khác là dối người dùng", () => {
    expect(validateRecoveryConfig({ ...base, registeredOnchain: true })).toBe(
      "ALREADY_REGISTERED_ONCHAIN",
    );
  });

  it("ngưỡng 0 bị chối (khôi phục không cần ai đồng ý = không phải khôi phục)", () => {
    expect(validateRecoveryConfig({ ...base, threshold: 0 })).toBe("THRESHOLD_OUT_OF_RANGE");
  });

  it("ngưỡng vượt MAX_GUARDIANS bị chối sớm thay vì để contract chối", () => {
    expect(validateRecoveryConfig({ ...base, threshold: 11 })).toBe("THRESHOLD_OUT_OF_RANGE");
  });

  it("thời gian chờ ngoài 3 lựa chọn bị chối (0 giây = bỏ hẳn cửa sổ veto)", () => {
    expect(validateRecoveryConfig({ ...base, timelockSecs: 0 })).toBe("TIMELOCK_NOT_ALLOWED");
    expect(validateRecoveryConfig({ ...base, timelockSecs: 12345 })).toBe("TIMELOCK_NOT_ALLOWED");
  });

  it("nhận cả 3 lựa chọn: 1 giờ / 24 giờ / 3 ngày", () => {
    for (const secs of [3600, 86400, 259200]) {
      expect(validateRecoveryConfig({ ...base, timelockSecs: secs })).toBeNull();
    }
  });
});
