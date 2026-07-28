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

  it("ngưỡng 1 bị chối — registry đòi MIN_THRESHOLD=2, một người bảo hộ đơn lẻ không tự quyết được", () => {
    // Trước bản vá, 1 lọt qua đây rồi mới panic `#3 InvalidThreshold` ở
    // `register_wallet` — tức hỏng ở BƯỚC CUỐI wizard, sau ceremony passkey.
    expect(validateRecoveryConfig({ ...base, threshold: 1 })).toBe("THRESHOLD_OUT_OF_RANGE");
  });

  it("ngưỡng vượt MAX_GUARDIANS bị chối sớm thay vì để contract chối", () => {
    expect(validateRecoveryConfig({ ...base, threshold: 11 })).toBe("THRESHOLD_OUT_OF_RANGE");
  });

  it("thời gian chờ ngoài 3 lựa chọn bị chối (0 giây = bỏ hẳn cửa sổ veto)", () => {
    expect(validateRecoveryConfig({ ...base, timelockSecs: 0 })).toBe("TIMELOCK_NOT_ALLOWED");
    expect(validateRecoveryConfig({ ...base, timelockSecs: 12345 })).toBe("TIMELOCK_NOT_ALLOWED");
  });

  it("1 giờ bị chối — DƯỚI sàn MIN_TIMELOCK_SECS=86_400 mà registry cưỡng chế on-chain", () => {
    // Đây là ca hồi quy của bug thật: 3600 từng nằm trong danh sách, UI render
    // nút "1 giờ", contract panic `#17 TimelockTooShort` ở bước cuối wizard.
    expect(validateRecoveryConfig({ ...base, timelockSecs: 3600 })).toBe("TIMELOCK_NOT_ALLOWED");
  });

  it("nhận cả 3 lựa chọn: 24 giờ / 3 ngày / 7 ngày — đều ≥ sàn on-chain", () => {
    for (const secs of [86400, 259200, 604800]) {
      expect(validateRecoveryConfig({ ...base, timelockSecs: secs })).toBeNull();
      expect(secs).toBeGreaterThanOrEqual(86400);
    }
  });
});
