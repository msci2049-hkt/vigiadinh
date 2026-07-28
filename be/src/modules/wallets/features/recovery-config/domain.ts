// Nghiệp vụ cấu hình khôi phục (ngưỡng + thời gian chờ) — THUẦN, test hermetic.
//
// Sự thật phải nói thẳng ở tầng này: threshold/timelock trong DB là MIRROR của
// contract, nguồn sự thật nằm on-chain. Registry v2 không có `set_threshold` —
// một khi `register_wallet` đã chạy thì hai giá trị này ĐÓNG BĂNG. Cho sửa sau
// đó là ghi vào DB một con số mà chain không công nhận: UI hiện "2/3" trong khi
// chain đòi 3/3, và người dùng chỉ phát hiện lúc cần cứu ví.

/**
 * Lựa chọn thời gian chờ, kèm đánh đổi để copy giải thích cho người thường.
 *
 * MỌI giá trị ở đây phải ≥ `MIN_TIMELOCK_SECS` của registry (86_400 —
 * `recovery-registry/src/lib.rs:74`, vá audit P0-2). Sàn đó cưỡng chế ON-CHAIN:
 * `register_wallet` panic `#17 TimelockTooShort` nếu thấp hơn. Trước bản này
 * danh sách còn `3600`, tức UI mời người dùng chọn một giá trị mà chain chối —
 * và vì `register_wallet` là bước CUỐI của wizard (chạy đúng một lần), họ đi hết
 * ceremony passkey rồi mới hỏng, với mã lỗi không đọc được.
 */
export const TIMELOCK_CHOICES_SECS = [86400, 259200, 604800] as const;
export type TimelockChoice = (typeof TIMELOCK_CHOICES_SECS)[number];

/** Handoff chốt 24h; ux-v2 cho chọn. Giữ mặc định 24h, mở lựa chọn. */
export const DEFAULT_TIMELOCK_SECS = 86400;
export const DEFAULT_THRESHOLD = 2;

/** Khớp MAX_GUARDIANS của registry — vượt là contract chối, chặn sớm ở đây. */
export const MAX_GUARDIANS = 10;

/**
 * Khớp `MIN_THRESHOLD` của registry (`lib.rs:71`): một người bảo hộ đơn lẻ
 * không bao giờ tự quyết được. Contract panic `#3 InvalidThreshold` nếu < 2 —
 * cùng bẫy "hỏng ở bước cuối wizard" như timelock ở trên.
 */
export const MIN_THRESHOLD = 2;

export type ConfigError =
  | "THRESHOLD_OUT_OF_RANGE"
  | "TIMELOCK_NOT_ALLOWED"
  | "ALREADY_REGISTERED_ONCHAIN";

/**
 * Kiểm một cấu hình đề xuất.
 *
 * `registeredOnchain` đọc TỪ CHAIN (`is_registered`), không đọc mirror: mirror
 * do indexer ghi, mà indexer có thể chậm/chết — dựa vào nó ở đây là cho phép
 * ghi đè một cấu hình đã đóng băng trên chain.
 */
export function validateRecoveryConfig(input: {
  threshold: number;
  timelockSecs: number;
  registeredOnchain: boolean;
}): ConfigError | null {
  if (input.registeredOnchain) return "ALREADY_REGISTERED_ONCHAIN";
  if (!Number.isInteger(input.threshold) || input.threshold < MIN_THRESHOLD) {
    return "THRESHOLD_OUT_OF_RANGE";
  }
  if (input.threshold > MAX_GUARDIANS) return "THRESHOLD_OUT_OF_RANGE";
  if (!TIMELOCK_CHOICES_SECS.includes(input.timelockSecs as TimelockChoice)) {
    return "TIMELOCK_NOT_ALLOWED";
  }
  return null;
}
