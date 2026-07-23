// WHY (D-052): BE là nguồn sự thật DUY NHẤT cho ngưỡng validate (password
// min/max, OTP length…). FE KHÔNG hardcode số trong schema (guard
// scripts/check-validation-parity.mjs chặn) — mọi ngưỡng đọc từ
// GET /api/config/validation (BE: src/lib/validation-limits.ts), fetch 1 lần
// lúc boot (prefetch ở provider.tsx), cache vĩnh viễn trong query cache.
//
// FALLBACK_LIMITS là nơi DUY NHẤT bên FE được chứa giá trị số — chỉ dùng khi
// endpoint chưa reachable (BE cũ / mất mạng lúc boot), và phải đồng bộ theo
// contract §8 CLAUDE.md. Sai fallback không phá an toàn: BE luôn re-validate.
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type ValidationLimits = {
  password: { minLength: number; maxLength: number };
  otp: { length: number };
};

export const FALLBACK_LIMITS: ValidationLimits = {
  password: { minLength: 12, maxLength: 128 },
  otp: { length: 6 },
};

export const validationLimitsQueryKey = ["config", "validation-limits"] as const;

export const validationLimitsOptions = queryOptions({
  queryKey: validationLimitsQueryKey,
  queryFn: async (): Promise<ValidationLimits> => {
    try {
      return await apiClient.get<ValidationLimits>("/api/config/validation");
    } catch {
      // BE down lúc boot: form vẫn phải render được → dùng fallback.
      // KHÔNG throw: retry loop lúc boot chỉ trì hoãn login page vô ích.
      return FALLBACK_LIMITS;
    }
  },
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  retry: false,
});

/** Ngưỡng validate cho form — luôn trả giá trị dùng được ngay (fallback khi chưa fetch xong). */
export function useValidationLimits(): ValidationLimits {
  const { data } = useQuery(validationLimitsOptions);
  return data ?? FALLBACK_LIMITS;
}
