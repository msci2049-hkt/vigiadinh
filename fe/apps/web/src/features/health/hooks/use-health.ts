import { useQuery } from "@tanstack/react-query";
import { healthQueryOptions } from "../api/health-api";

export function useHealth() {
  return useQuery(healthQueryOptions());
}
