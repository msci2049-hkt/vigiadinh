import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export const healthKeys = {
  all: ["health"] as const,
};

export interface HealthResponse {
  ok: boolean;
}

/** Pings BE `GET /health`, expecting `{ "ok": true }`. */
export function healthQueryOptions() {
  return queryOptions({
    queryKey: healthKeys.all,
    queryFn: () => apiClient.get<HealthResponse>("/health"),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
