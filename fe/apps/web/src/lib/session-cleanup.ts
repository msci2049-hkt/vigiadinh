// Sổ đăng ký dọn dẹp khi ĐĂNG XUẤT (QA "logout xoá thật" — §2.1 fe-smooth).
//
// Vì sao cần: phiên ví SEP-45 (fw.wallet-jwt, features/wallet) phải bị xoá khi
// người dùng đăng xuất phiên app (features/auth), nhưng hai feature CẤM import
// chéo. Mỗi feature tự đăng ký việc dọn của mình ở đây (lib — cả hai đều import
// được); nút đăng xuất chỉ gọi runSessionCleanup() mà không cần biết ai dọn gì.
type CleanupFn = () => void;

const cleanups = new Set<CleanupFn>();

/** Feature đăng ký việc dọn của mình lúc module init (best-effort, không throw). */
export function registerSessionCleanup(fn: CleanupFn): void {
  cleanups.add(fn);
}

/** Chạy MỌI việc dọn đã đăng ký. Một cái hỏng không chặn cái khác. */
export function runSessionCleanup(): void {
  for (const fn of cleanups) {
    try {
      fn();
    } catch {
      // Dọn dẹp là best-effort — storage hỏng/không có thì bỏ qua.
    }
  }
}

/** Chỉ test: reset registry giữa các test. */
export function resetSessionCleanupForTest(): void {
  cleanups.clear();
}
