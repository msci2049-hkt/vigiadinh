import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

// LẰN RANH TIỀN: KHÔNG thêm persistQueryClient/persister vào client này. Mọi
// query của ví (số dư, recovery/veto, guardian, di chúc) đọc từ mạng mỗi phiên;
// ghi chúng xuống disk browser là hiển thị trạng thái an ninh cũ — kịch bản #3
// của audit (veto mù). Cần persist thứ gì cosmetic thì mở allowlist tường minh
// `meta.persist === true` kèm review, không nới mặc định ở đây.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry client errors (401/403/404/422) — they won't fix themselves.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: { retry: 0 },
    },
  });
}
