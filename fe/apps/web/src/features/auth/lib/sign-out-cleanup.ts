// Đăng xuất TRỌN VẸN (QA "logout xoá thật"): kết thúc phiên Better Auth, chạy
// mọi dọn dẹp đã đăng ký (phiên ví SEP-45…), rồi XOÁ SẠCH query cache.
//
// Vì sao clear() cả cache chứ không chỉ session key: staleTime 60s nghĩa là
// người kế tiếp đăng nhập trên cùng tab trong vòng 1 phút sẽ được trả ví/
// người bảo hộ của người TRƯỚC thẳng từ cache mà không refetch. Ở ví thì đó
// là rò dữ liệu giữa hai người dùng, không phải tối ưu.
import type { QueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth-client";
import { runSessionCleanup } from "@/lib/session-cleanup";

export async function performSignOut(queryClient: QueryClient): Promise<void> {
  try {
    await signOut();
  } finally {
    // BE không với tới vẫn phải dọn máy này — phiên local chết là chắc chắn.
    runSessionCleanup();
    queryClient.clear();
  }
}
