import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardKeys.all, "summary"] as const,
};

export interface DashboardSummary {
  notifications: number;
  updatedAt: string;
}

export function dashboardSummaryOptions() {
  return queryOptions({
    queryKey: dashboardKeys.summary(),
    queryFn: () => apiClient.get<DashboardSummary>("/api/dashboard/summary"),
  });
}
