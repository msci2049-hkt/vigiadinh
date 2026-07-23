import { useQuery } from "@tanstack/react-query";
import { dashboardSummaryOptions } from "../api/dashboard-api";

export function useDashboardSummary() {
  return useQuery(dashboardSummaryOptions());
}
